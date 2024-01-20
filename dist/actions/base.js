"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const draftlog_1 = __importDefault(require("draftlog"));
const lodash_1 = __importDefault(require("lodash"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const ora_1 = __importDefault(require("ora"));
const pg_1 = require("pg");
const constants_1 = require("../constants");
const helpers_1 = require("../helpers");
const interfaces_1 = require("../interfaces");
const { Pool } = pg_1.native;
(0, draftlog_1.default)(console);
class PostgrabBaseClass {
    constructor(config) {
        this.config = config;
        this.tables = {};
        this.remoteTableNames = [];
        this.tableRowCount = {};
        this.pool = {};
        this.draft = console.draft;
        this.status = new ora_1.default();
        this.config = config;
        lodash_1.default.forEach([interfaces_1.DatabaseSource.LOCAL, interfaces_1.DatabaseSource.REMOTE], (source) => {
            if (!this.pool[source])
                this.createPool(source);
        });
    }
    async init() {
        if (this.config.setup)
            await this.runSetup();
        await this.testConnections();
        await this.getTableNames(interfaces_1.DatabaseSource.REMOTE);
        await this.getRemoteMetadataForTargetTables();
        this.status.stop();
    }
    createPool(source) {
        this.pool[source] = new Pool((0, helpers_1.parseConnectionString)(this.config[source]));
        this.pool[source].on('error', (e) => {
            if (!/terminating connection/.test(e.message)) {
                console.error(chalk_1.default.red(`Error encountered in the ${source} query pool: ${e.message}`));
            }
        });
    }
    abstractQuery(source, queryable) {
        const result = this.pool[source].query(queryable);
        return typeof queryable === 'string' ? result.then((val) => lodash_1.default.get(val, `rows`)) : result;
    }
    get query() {
        return {
            local: this.abstractQuery.bind(this, interfaces_1.DatabaseSource.LOCAL),
            remote: this.abstractQuery.bind(this, interfaces_1.DatabaseSource.REMOTE),
        };
    }
    async checkForTablesLocally() {
        this.status.start(`Ensuring that all tables exist locally`);
        const localTables = (await this.getTableNames(interfaces_1.DatabaseSource.LOCAL));
        const missingTables = lodash_1.default.difference(this.config.tables, localTables);
        if (lodash_1.default.size(missingTables)) {
            console.error(chalk_1.default.red(`\nThe following tables don't exist locally: `) +
                missingTables.join(`, `));
            console.error(`\nTip: Try running ${chalk_1.default.green(`postgrab --schema-only`)} in order to sync the schema for these tables`);
            process.exit();
        }
    }
    async getRemoteMetadataForTargetTables() {
        const tables = this.config.tables;
        this.status.start(`Retrieving table/column metadata for ${tables.length} tables`);
        await Promise.all(lodash_1.default.map(tables, async (table) => {
            const primaryKey = (await this.query
                .remote(`
        SELECT a.attname as column
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = '"${table}"'::regclass
           AND i.indisprimary
      `)
                .then((rows) => lodash_1.default.get(rows, `0.column`, `id`)));
            const columns = (await this.query.remote(`
        SELECT column_name AS name,
               data_type AS type,
               CASE WHEN column_name = '${primaryKey}' THEN TRUE ELSE FALSE END AS "isPrimaryKey"
          FROM information_schema.columns
         WHERE table_schema = '${this.config.schema}'
           AND table_name = '${table}'
      `));
            const uniqueIndices = (await this.query
                .remote(`
           SELECT c.relname AS name,
                  ind.indexdef AS definition
             FROM pg_class c
             JOIN pg_index i ON c.oid = i.indexrelid
              AND c.relkind='i'
              AND c.relname NOT LIKE 'pg_%'
             JOIN pg_class t ON t.oid = i.indrelid
             JOIN pg_indexes ind ON ind.indexname = c.relname
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid
              AND a.attnum = ANY(i.indkey)
            WHERE t.relname = '${table}'
              AND indisunique IS TRUE
         GROUP BY t.relname, c.relname, ind.indexdef
      `)
                .then((rows) => lodash_1.default.map(rows, ({ name, definition }) => {
                const whereClause = (definition.match(/WHERE (.*)/i) || [])[1];
                const columns = (0, helpers_1.extractColumnNamesFromSqlStatement)(definition);
                return { name, whereClause, columns };
            })));
            this.tables[table] = {
                name: table,
                columns,
                primaryKey,
                uniqueIndices,
            };
        }));
    }
    async getTableNames(source) {
        this.status.start(`Getting ${source} table names`);
        const tableNames = await this.query[source](`
      SELECT table_name AS name
        FROM information_schema.tables
       WHERE table_schema = '${this.config.schema}'
         AND table_type != 'VIEW'
    `).then((rows) => lodash_1.default.map(rows, `name`));
        if (source === interfaces_1.DatabaseSource.LOCAL)
            return tableNames;
        this.remoteTableNames.push(...tableNames);
        if (this.config.tables.length) {
            lodash_1.default.forEach(this.config.tables, (table) => {
                if (!lodash_1.default.includes(this.remoteTableNames, table)) {
                    console.error(chalk_1.default.red(`\nCouldn't find the table ${chalk_1.default.white(table)} on the remote database`));
                    process.exit();
                }
            });
        }
        else {
            this.config.tables = this.config.schemaOnly
                ? this.remoteTableNames
                : lodash_1.default.difference(this.remoteTableNames, this.config.exclude);
        }
    }
    streamingCopy(remoteCmd, localCmd) {
        const remoteStream = (0, child_process_1.spawn)(`psql`, [
            `-d`,
            `${this.config.remote}`,
            `--no-psqlrc`,
            `-c`,
            remoteCmd,
        ]);
        const localStream = (0, child_process_1.spawn)(`psql`, [
            `-d`,
            `${this.config.local}`,
            `--no-psqlrc`,
            `-c`,
            localCmd,
        ]);
        remoteStream.stdout.pipe(localStream.stdin);
        return remoteStream;
    }
    async streamingMergeCopy(tableData, remoteCmd) {
        const table = tableData.name;
        const remoteWhereClause = await this.getRemoteWhereClauseForTable(table);
        const SCHEMA_AND_TABLE = `"${this.config.schema}"."${table}"`;
        const TEMP_TABLE = `temp_${table}`;
        const timeout = 600000;
        const withStatement = this.config.withStatements[table];
        remoteCmd =
            remoteCmd ||
                `
      BEGIN; SET statement_timeout TO ${timeout}; COMMIT;
      COPY (${withStatement ? withStatement : ''}
        SELECT * FROM ${SCHEMA_AND_TABLE}${remoteWhereClause ? ` ${remoteWhereClause}` : ``}
      ) TO STDOUT`;
        const uniqueWhereClause = lodash_1.default.compact(lodash_1.default.flatMap(tableData.uniqueIndices, ({ columns, whereClause }) => {
            const hasJSONColumnAccessors = lodash_1.default.find(columns, (column) => lodash_1.default.includes(constants_1.JSON_COLUMN_ACCESSORS, lodash_1.default.get(column, '0.String.str')));
            if (hasJSONColumnAccessors)
                return;
            const clauses = lodash_1.default.map(columns, (col) => col && `target_table."${col}" = temp_table."${col}"`);
            if (whereClause) {
                clauses.push(...lodash_1.default.map([`target_table`, `temp_table`], (prefix) => {
                    return (0, helpers_1.prefixColumnNamesInWhereClause)(whereClause, prefix);
                }));
            }
            return clauses && `(${clauses.join(` AND `)})`;
        })).join(` OR `) ||
            `target_table.${tableData.primaryKey} = temp_table.${tableData.primaryKey}`;
        const localCmd = `
      BEGIN;
      CREATE TEMPORARY TABLE ${TEMP_TABLE} AS SELECT * FROM ${SCHEMA_AND_TABLE} WITH NO DATA;
      COPY ${TEMP_TABLE} FROM STDIN;
      DELETE FROM ${SCHEMA_AND_TABLE} AS target_table USING ${TEMP_TABLE} AS temp_table WHERE ${uniqueWhereClause};
      INSERT INTO ${SCHEMA_AND_TABLE} SELECT * FROM ${TEMP_TABLE};
      DROP TABLE ${TEMP_TABLE};
      COMMIT;
    `;
        return this.streamingCopy(remoteCmd, localCmd);
    }
    async testConnections() {
        for (const source of [interfaces_1.DatabaseSource.LOCAL, interfaces_1.DatabaseSource.REMOTE]) {
            const statusText = `Testing ${source} connection`;
            this.status.start(statusText);
            const fail = (e) => {
                this.status.fail(e ? statusText + chalk_1.default.red(` [${e}]`) : statusText);
                console.error(chalk_1.default.red(`\nFailed to establish ${source} connection\n`));
                process.exit();
            };
            let timeout = setTimeout(fail, 15000);
            try {
                await this.query[source](`SELECT 1;`);
            }
            catch (e) {
                fail(e);
            }
            clearTimeout(timeout);
        }
    }
    async getLocalMaxForTable(table) {
        const bookmark = this.config.bookmarks[table];
        const bookmarkMetadata = lodash_1.default.find(lodash_1.default.get(this.tables, [table, `columns`]), ({ name }) => name === bookmark);
        if (!bookmarkMetadata)
            return;
        const dataType = lodash_1.default.get(bookmarkMetadata, `type`);
        if (!dataType) {
            console.error(chalk_1.default.red(`\nCould not determine the data type of column ` +
                `${chalk_1.default.white(bookmark)} on table ${chalk_1.default.white(table)}`));
            process.exit();
        }
        return await this.query
            .local(`
      SELECT MAX(${bookmark})
        FROM "${this.config.schema}"."${table}"
    `)
            .then((rows) => {
            const localMax = lodash_1.default.get(rows, `0.max`);
            return dataType === interfaces_1.BookmarkableDataType.INTEGER
                ? Number(localMax)
                : (0, moment_timezone_1.default)(localMax).toISOString();
        });
    }
    async getRemoteWhereClauseForTable(table) {
        const localMax = await this.getLocalMaxForTable(table)
            .then((max) => (lodash_1.default.isNumber(max) ? max : max && `'${max}'`));
        const bookmark = this.config.bookmarks[table];
        const greaterThanLocalMax = bookmark && localMax && `${bookmark} > ${localMax}`;
        const partial = (this.config.partials[table] || ``).replace(/WHERE\s?/i, ``);
        if (!partial && (!localMax || !bookmark))
            return ``;
        return `WHERE ` + lodash_1.default.compact([partial, greaterThanLocalMax]).join(` AND `);
    }
    async runSetup() {
        try {
            this.status.start(`Running setup command`);
            await (0, helpers_1.exec)(this.config.setup);
        }
        catch (e) {
            console.error(chalk_1.default.red(`\nEncountered the following error while running the user-specified setup command\n`));
            console.error(e);
            process.exit();
        }
    }
}
exports.default = PostgrabBaseClass;
