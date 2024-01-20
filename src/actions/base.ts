import chalk from 'chalk'
import { ChildProcess, spawn } from 'child_process'
import DraftLog from 'draftlog'
import _ from 'lodash'
import moment from 'moment-timezone'
import Ora from 'ora'
import { native } from 'pg'
import stream from 'stream'

import { JSON_COLUMN_ACCESSORS } from '../constants'
import {
    exec,
    extractColumnNamesFromSqlStatement,
    parseConnectionString,
    prefixColumnNamesInWhereClause,
} from '../helpers'
import {
    BookmarkableDataType,
    ColumnMetadata,
    DatabaseSource,
    LocalAndRemotePool,
    PostgrabConfig,
    TableMetadata,
    UniqueIndexMetadata,
} from '../interfaces'

const { Pool } = native

DraftLog(console)

/**
 * Base action class which provides common functionalities for its subclasses.
 */
export default abstract class PostgrabBaseClass {
    tables: { [tableName: string]: TableMetadata } = {}
    remoteTableNames: string[] = []
    tableRowCount: { [table: string]: number } = {}
    pool: LocalAndRemotePool = {}
    draft = (console as any).draft
    status: Ora = new Ora()

    constructor(public config: PostgrabConfig) {
        this.config = config
        _.forEach([DatabaseSource.LOCAL, DatabaseSource.REMOTE], (source) => {
            if (!this.pool[source]) this.createPool(source)
        })
    }

    abstract run(): Promise<any>

    /**
     * Initializes the instance by testing local/remote connections and retrieving
     * remote table names/metadata.
     */
    async init(): Promise<void> {
        if (this.config.setup) await this.runSetup()
        await this.testConnections()
        await this.getTableNames(DatabaseSource.REMOTE)
        await this.getRemoteMetadataForTargetTables()
        this.status.stop()
    }

    /**
     * Initiates (or re-initiates) the local or remote client pool.
     */
    createPool(source: DatabaseSource): void {
        this.pool[source] = new Pool(parseConnectionString(this.config[source]) as any)
        this.pool[source].on('error', (e) => {
            if (!/terminating connection/.test(e.message)) {
                console.error(
                    chalk.red(`Error encountered in the ${source} query pool: ${e.message}`),
                )
            }
        })
    }

    /**
     * Abstract interface to both our local/remote client pools. Accepts a
     * 'queryable' which is either a string or a readable stream. If 'queryable'
     * is a string, it returns a promise which resolves to the resulting rows. If
     * 'queryable' is a readable stream, it returns a readable stream.
     */
    abstractQuery(
        source: DatabaseSource,
        queryable: string | stream.Readable,
    ): Promise<any[]> | stream.Readable {
        const result = this.pool[source].query(queryable)
        return typeof queryable === 'string' ? result.then((val) => _.get(val, `rows`)) : result
    }

    /**
     * A thin wrapper around 'abstractQuery' so that we can easily access
     * local/remote client pools for querying
     */
    get query() {
        return {
            local: this.abstractQuery.bind(this, DatabaseSource.LOCAL),
            remote: this.abstractQuery.bind(this, DatabaseSource.REMOTE),
        }
    }

    /**
     * Ensures that all target tables exist locally. If one or more tables are
     * missing, postgrab will complain and advise the user to run postgrab again with
     * the '--schema-only' flag.
     */
    async checkForTablesLocally() {
        this.status.start(`Ensuring that all tables exist locally`)
        const localTables = (await this.getTableNames(DatabaseSource.LOCAL)) as string[]
        const missingTables = _.difference(this.config.tables, localTables)
        if (_.size(missingTables)) {
            console.error(
                chalk.red(`\nThe following tables don't exist locally: `) +
                    missingTables.join(`, `),
            )
            console.error(
                `\nTip: Try running ${chalk.green(
                    `postgrab --schema-only`,
                )} in order to sync the schema for these tables`,
            )
            process.exit()
        }
    }

    /**
     * Retrieves the following metadata from the remote database for the target tables:
     *   - Primary key (defaults to 'id')
     *   - Columns (data type and whether or not it's the primary key)
     *   - Unique indices
     */
    async getRemoteMetadataForTargetTables() {
        const tables = this.config.tables
        this.status.start(`Retrieving table/column metadata for ${tables.length} tables`)
        await Promise.all(
            _.map(tables, async (table) => {
                const primaryKey = (await this.query
                    .remote(
                        `
        SELECT a.attname as column
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = '"${table}"'::regclass
           AND i.indisprimary
      `,
                    )
                    .then((rows) => _.get(rows, `0.column`, `id`))) as string

                const columns = (await this.query.remote(`
        SELECT column_name AS name,
               data_type AS type,
               CASE WHEN column_name = '${primaryKey}' THEN TRUE ELSE FALSE END AS "isPrimaryKey"
          FROM information_schema.columns
         WHERE table_schema = '${this.config.schema}'
           AND table_name = '${table}'
      `)) as ColumnMetadata[]

                const uniqueIndices = (await this.query
                    .remote(
                        `
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
      `,
                    )
                    .then((rows) =>
                        _.map(rows, ({ name, definition }) => {
                            const whereClause = (definition.match(/WHERE (.*)/i) || [])[1]
                            const columns = extractColumnNamesFromSqlStatement(definition)
                            return { name, whereClause, columns }
                        }),
                    )) as UniqueIndexMetadata[]

                this.tables[table] = <TableMetadata>{
                    name: table,
                    columns,
                    primaryKey,
                    uniqueIndices,
                }
            }),
        )
    }

    /**
     * Queries the 'information_schema' table in order to get the names of all
     * tables in the user-specified schema. If being called for the local
     * database, it simply returns the table names that it finds. If called for
     * the remote database, it stores the table names and ensures that all of our
     * target tables exist on the remote database.
     */
    async getTableNames(source: DatabaseSource): Promise<string[] | void> {
        this.status.start(`Getting ${source} table names`)
        const tableNames = await this.query[source](
            `
      SELECT table_name AS name
        FROM information_schema.tables
       WHERE table_schema = '${this.config.schema}'
         AND table_type != 'VIEW'
    `,
        ).then((rows) => _.map(rows, `name`))
        if (source === DatabaseSource.LOCAL) return tableNames

        this.remoteTableNames.push(...tableNames)

        if (this.config.tables.length) {
            _.forEach(this.config.tables, (table) => {
                if (!_.includes(this.remoteTableNames, table)) {
                    console.error(
                        chalk.red(
                            `\nCouldn't find the table ${chalk.white(
                                table,
                            )} on the remote database`,
                        ),
                    )
                    process.exit()
                }
            })
        } else {
            this.config.tables = this.config.schemaOnly
                ? this.remoteTableNames
                : _.difference(this.remoteTableNames, this.config.exclude)
        }
    }

    /**
     * Streams a remote 'COPY TO' command into the stdin of a local 'COPY FROM'
     * command and returns the remote stream.
     *
     * @todo Add support for stream transformation so that we can keep sensitive
     * data more secure (i.e. inject unique fake phone numbers into 'phone' cols)
     */
    streamingCopy(remoteCmd: string, localCmd: string): any {
        const remoteStream = spawn(`psql`, [
            `-d`,
            `${this.config.remote}`,
            `--no-psqlrc`,
            `-c`,
            remoteCmd,
        ])
        const localStream = spawn(`psql`, [
            `-d`,
            `${this.config.local}`,
            `--no-psqlrc`,
            `-c`,
            localCmd,
        ])
        remoteStream.stdout.pipe(localStream.stdin)

        return remoteStream
    }

    /**
     * This method streams remote data but merges it with any existing local data
     * in each table.
     */
    async streamingMergeCopy(tableData: TableMetadata, remoteCmd?: string): Promise<ChildProcess> {
        const table = tableData.name
        const remoteWhereClause = await this.getRemoteWhereClauseForTable(table)
        const SCHEMA_AND_TABLE = `"${this.config.schema}"."${table}"`
        const TEMP_TABLE = `temp_${table}`
        const timeout = 600000 // 10 minutes.

        const withStatement = this.config.withStatements[table]

        remoteCmd =
            remoteCmd ||
            `
      BEGIN; SET statement_timeout TO ${timeout}; COMMIT;
      COPY (${withStatement ? withStatement : ''}
        SELECT * FROM ${SCHEMA_AND_TABLE}${remoteWhereClause ? ` ${remoteWhereClause}` : ``}
      ) TO STDOUT`

        // This is where we programmatically guard against every possible unique
        // constraint violation by generating a `WHERE` clause that will delete
        // any/all conflicting rows from the target table before copying their
        // updated version from the temporary table. If no unique indices exist,
        // we'll delete everything where all columns match
        const uniqueWhereClause =
            _.compact(
                _.flatMap(tableData.uniqueIndices, ({ columns, whereClause }) => {
                    const hasJSONColumnAccessors = _.find(columns, (column) =>
                        // The '0.String.str' will be the path to the JSON/JSONB accessor
                        // operator if it's being used in the index
                        _.includes(JSON_COLUMN_ACCESSORS, _.get(column, '0.String.str')),
                    )
                    // TODO: Add support for unique indices which utilize JSON/JSONB
                    // accessor operators
                    if (hasJSONColumnAccessors) return
                    const clauses = _.map(
                        columns,
                        (col) => col && `target_table."${col}" = temp_table."${col}"`,
                    )
                    if (whereClause) {
                        clauses.push(
                            ..._.map([`target_table`, `temp_table`], (prefix) => {
                                return prefixColumnNamesInWhereClause(whereClause, prefix)
                            }),
                        )
                    }
                    return clauses && `(${clauses.join(` AND `)})`
                }),
            ).join(` OR `) ||
            // If there are no unique indices (should be a rare case because primary
            // keys must be unique), just use the primary key as one even if it's our
            // "guess" of which column is the primary key
            `target_table.${tableData.primaryKey} = temp_table.${tableData.primaryKey}`
        const localCmd = `
      BEGIN;
      CREATE TEMPORARY TABLE ${TEMP_TABLE} AS SELECT * FROM ${SCHEMA_AND_TABLE} WITH NO DATA;
      COPY ${TEMP_TABLE} FROM STDIN;
      DELETE FROM ${SCHEMA_AND_TABLE} AS target_table USING ${TEMP_TABLE} AS temp_table WHERE ${uniqueWhereClause};
      INSERT INTO ${SCHEMA_AND_TABLE} SELECT * FROM ${TEMP_TABLE};
      DROP TABLE ${TEMP_TABLE};
      COMMIT;
    `

        return this.streamingCopy(remoteCmd, localCmd)
    }

    /**
     * Ensures that we can establish local/remote db connections
     */
    async testConnections() {
        for (const source of [DatabaseSource.LOCAL, DatabaseSource.REMOTE]) {
            const statusText = `Testing ${source} connection`
            this.status.start(statusText)
            const fail = (e?: Error) => {
                this.status.fail(e ? statusText + chalk.red(` [${e}]`) : statusText)
                console.error(chalk.red(`\nFailed to establish ${source} connection\n`))
                process.exit()
            }
            let timeout = setTimeout(fail, 15000)
            try {
                await this.query[source](`SELECT 1;`)
            } catch (e) {
                fail(e)
            }
            clearTimeout(timeout)
        }
    }

    async getLocalMaxForTable(table: string) {
        const bookmark = this.config.bookmarks[table]
        const bookmarkMetadata = _.find(
            _.get(this.tables, [table, `columns`]),
            ({ name }: any) => name === bookmark,
        )
        if (!bookmarkMetadata) return

        const dataType = _.get(bookmarkMetadata, `type`)
        if (!dataType) {
            console.error(
                chalk.red(
                    `\nCould not determine the data type of column ` +
                        `${chalk.white(bookmark)} on table ${chalk.white(table)}`,
                ),
            )
            process.exit()
        }

        return await this.query
            .local(
                `
      SELECT MAX(${bookmark})
        FROM "${this.config.schema}"."${table}"
    `,
            )
            .then((rows) => {
                const localMax = _.get(rows, `0.max`)

                // Make sure we cast the value to the correct data type
                return dataType === BookmarkableDataType.INTEGER
                    ? Number(localMax)
                    : moment(localMax).toISOString()
            })
    }

    /**
     * This is specific to the remote database because it relies on the max value
     * for the same table on the local database
     */
    async getRemoteWhereClauseForTable(table: string) {
        const localMax = await this.getLocalMaxForTable(table)
            // Deal with single quoting our max here (or not, if it's a number)
            .then((max) => (_.isNumber(max) ? max : max && `'${max}'`))
        const bookmark = this.config.bookmarks[table]

        const greaterThanLocalMax = bookmark && localMax && `${bookmark} > ${localMax}`
        const partial = (this.config.partials[table] || ``).replace(/WHERE\s?/i, ``)
        if (!partial && (!localMax || !bookmark)) return ``
        return `WHERE ` + _.compact([partial, greaterThanLocalMax]).join(` AND `)
    }

    /**
     * Executes any setup commands provided by the user _prior_ to kicking off any
     * local/remote network requests
     */
    async runSetup() {
        try {
            this.status.start(`Running setup command`)
            await exec(this.config.setup)
        } catch (e) {
            console.error(
                chalk.red(
                    `\nEncountered the following error while running the user-specified setup command\n`,
                ),
            )
            console.error(e)
            process.exit()
        }
    }
}
