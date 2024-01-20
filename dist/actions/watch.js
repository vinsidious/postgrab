"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const lodash_1 = __importDefault(require("lodash"));
const constants = __importStar(require("../constants"));
const helpers_1 = require("../helpers");
const base_1 = __importDefault(require("./base"));
const MAX_ROWS_PER_FETCH = 1000;
class Watch extends base_1.default {
    constructor() {
        super(...arguments);
        this.tableStatus = {};
        this.initialRowCount = {};
        this.lastBookmarkValue = {};
    }
    async run() {
        await Promise.all(lodash_1.default.map(this.config.tables, async (table) => {
            this.lastBookmarkValue[table] = await this.getLocalMaxForTable(table);
            this.initialRowCount[table] = await this.getRowCount(table, this.lastBookmarkValue[table]);
        }));
        console.log(this.initialRowCount);
        lodash_1.default.forEach(this.config.tables, (table) => {
            this.tableStatus[table] = this.draft();
            const spinner = new helpers_1.Spinner();
            setInterval(async () => {
                const currentRowCount = await this.getRowCount(table, this.lastBookmarkValue[table]);
                const diffRowCount = currentRowCount - this.initialRowCount[table];
                this.tableStatus[table](`${spinner.spin()} ${chalk_1.default.blue.underline(table)} — pulled ${chalk_1.default.green(String(diffRowCount))} total`);
                this.initialRowCount[table] = currentRowCount;
            }, constants.LOG_LINE_UPDATE_INTERVAL_MS);
        });
        while (true) {
            await Promise.all(lodash_1.default.map(this.config.tables, (table) => this.getNewRowsForTable(table)));
            await (0, helpers_1.sleep)(this.config.watchIntervalSeconds * 1000);
        }
    }
    async getRowCount(table, lastBookmarkValue) {
        const bookmarkColumn = this.config.bookmarks[table];
        const SCHEMA_AND_TABLE = `"${this.config.schema}"."${table}"`;
        const query = `SELECT COUNT(*) AS count FROM ${SCHEMA_AND_TABLE} WHERE "${bookmarkColumn}" > $1`;
        try {
            const res = await this.pool['remote'].query(query, [lastBookmarkValue]);
            return parseInt(res.rows[0].count, 10);
        }
        catch (error) {
            console.error(chalk_1.default.red(`Error getting row count for table ${chalk_1.default.white(table)}`), error);
            process.exit(1);
        }
    }
    async getNewRowsForTable(table) {
        const bookmark = this.config.bookmarks[table];
        if (!bookmark) {
            console.error(chalk_1.default.red(`You haven't configured a bookmark column for the ${chalk_1.default.white(table)} table`));
            process.exit();
        }
        const remoteConditions = await this.getRemoteWhereClauseForTable(table);
        const SCHEMA_AND_TABLE = `"${this.config.schema}"."${table}"`;
        const timeout = 600000;
        const remoteCmd = `
      BEGIN; SET statement_timeout TO ${timeout}; COMMIT;
      COPY (SELECT *
              FROM ${SCHEMA_AND_TABLE} ${remoteConditions || ''}
          ORDER BY ${bookmark} DESC NULLS LAST
             LIMIT ${MAX_ROWS_PER_FETCH}
      ) TO STDOUT
    `;
        const _stream = await this.streamingMergeCopy(this.tables[table], remoteCmd);
        return await new Promise((resolve, reject) => {
            _stream.stderr.on(`data`, (data) => process.stderr.write(data));
            _stream.on(`close`, resolve);
        });
    }
}
exports.default = Watch;
