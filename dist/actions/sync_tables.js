'use strict'
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              var desc = Object.getOwnPropertyDescriptor(m, k)
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k]
                      },
                  }
              }
              Object.defineProperty(o, k2, desc)
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              o[k2] = m[k]
          })
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v })
          }
        : function (o, v) {
              o['default'] = v
          })
var __importStar =
    (this && this.__importStar) ||
    function (mod) {
        if (mod && mod.__esModule) return mod
        var result = {}
        if (mod != null)
            for (var k in mod)
                if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k)
        __setModuleDefault(result, mod)
        return result
    }
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.worker = void 0
const approximate_number_1 = __importDefault(require('approximate-number'))
const chalk_1 = __importDefault(require('chalk'))
const child_process_1 = require('child_process')
const lodash_1 = __importDefault(require('lodash'))
const path_1 = __importDefault(require('path'))
const pluralize_1 = __importDefault(require('pluralize'))
const split2_1 = __importDefault(require('split2'))
const constants = __importStar(require('../constants'))
const helpers_1 = require('../helpers')
const interfaces_1 = require('../interfaces')
const base_1 = __importDefault(require('./base'))
const tableTimeToSync = {}
async function worker() {
    const config = JSON.parse(process.env.CONFIG)
    const table = process.env.TABLE
    const worker = new SyncTables(config)
    worker.tables = JSON.parse(process.env.ALL_TABLES)
    await worker.syncTable(table)
}
exports.worker = worker
class SyncTables extends base_1.default {
    constructor() {
        super(...arguments)
        this.workers = []
        this.whereClauses = {}
        this.remoteRowCounts = {}
    }
    async run() {
        await this.checkForTablesLocally()
        if (this.config.truncate) await this.truncateLocalTargetTables()
        const tableCount = this.config.tables.length
        this.workerCount = lodash_1.default.min([this.config.maxWorkers, tableCount])
        this.workers = new Array(this.workerCount).fill(`WORKER`)
        this.status.info(
            `Syncing ${(0, pluralize_1.default)('table', tableCount, true)} across ${(0, pluralize_1.default)('worker', this.workerCount, true)}`,
        )
        await this.runMaster()
        if (this.config.metrics) {
            this.printMetrics()
        }
    }
    async runMaster() {
        return new Promise(async (resolve, reject) => {
            while (this.config.tables.length || this.workers.length !== this.workerCount) {
                await (0, helpers_1.sleep)(5)
                const worker = this.workers.pop()
                const table = this.config.tables.pop()
                if (!worker || !table) {
                    if (worker) this.workers.push(worker)
                    if (table) this.config.tables.push(table)
                } else {
                    this.spawnWorkerForTable(worker, table)
                }
            }
            resolve()
        })
    }
    async spawnWorkerForTable(worker, table) {
        const startTime = new Date()
        let count = 0,
            remoteCount,
            localCount = 1,
            whereClause = ``
        const syncInfoString = ` Syncing ${chalk_1.default.blue.underline(table)}${whereClause ? chalk_1.default.dim(` <partial>`) : ``}`
        const status = this.draft(syncInfoString)
        const spinner = new helpers_1.Spinner()
        const interval = setInterval(() => {
            status(
                spinner.spin() +
                    syncInfoString +
                    ` [${chalk_1.default.green(String(lodash_1.default.round(100 * (count / (remoteCount || 1)))))}%]`,
            )
        }, constants.LOG_LINE_UPDATE_INTERVAL_MS)
        whereClause = this.whereClauses[table] = await this.getRemoteWhereClauseForTable(table)
        ;[localCount, remoteCount] = await Promise.all([
            this.getCountForTableAndSource(table, interfaces_1.DatabaseSource.LOCAL),
            this.getCountForTableAndSource(table, interfaces_1.DatabaseSource.REMOTE),
        ])
        if (localCount >= remoteCount) {
            status(
                chalk_1.default.green(`✔ `) +
                    `No new rows to dump for ${chalk_1.default.blue.underline(table)} table`,
            )
            this.workers.push(worker)
            clearInterval(interval)
            return
        }
        const execString = `require('${path_1.default.join(__dirname, '../../dist/actions/index.js')}').worker().then(process.exit)`
        const child = (0, child_process_1.spawn)(process.execPath, [`-e`, execString], {
            env: {
                ...process.env,
                CONFIG: JSON.stringify(this.config),
                ALL_TABLES: JSON.stringify(this.tables),
                TABLE: table,
            },
        })
        await new Promise((resolve) => {
            child.on(`close`, () => {
                clearInterval(interval)
                const timeToSync = lodash_1.default.round((+new Date() - +startTime) / 1000)
                tableTimeToSync[table] = timeToSync
                status(
                    chalk_1.default.green(`✔`) +
                        syncInfoString +
                        ` [${(0, approximate_number_1.default)(remoteCount)} rows — ` +
                        `${chalk_1.default.yellow(timeToSync + 's')}]`,
                )
                resolve(this.workers.push(worker))
            })
            child.on(`error`, (error) => {
                console.log(
                    chalk_1.default.red(
                        `Error encountered: ${chalk_1.default.white(error.toString())}`,
                    ),
                )
                process.exit()
            })
            child.stderr.on(`data`, (data) => {
                console.log(
                    chalk_1.default.red(
                        `Error encountered: ${chalk_1.default.white(data.toString())}`,
                    ),
                )
            })
            child.stdout.on(`data`, (data) => {
                count += data.length
            })
        })
    }
    async getCountForTableAndSource(table, source) {
        const withStatement = this.config.withStatements[table]
        return await this.query[source](
            `${withStatement ? withStatement : ''}
      SELECT COUNT(*)
        FROM "${this.config.schema}"."${table}"${this.whereClauses[table] ? ` ${this.whereClauses[table]}` : ``}
    `,
        ).then((rows) => ~~lodash_1.default.get(rows, `0.count`, 0))
    }
    async localAndRemoteCountsMatch(table) {
        const localCount = await this.getCountForTableAndSource(
            table,
            interfaces_1.DatabaseSource.LOCAL,
        )
        return localCount === this.remoteRowCounts[table]
    }
    printMetrics() {
        if (lodash_1.default.isEmpty(tableTimeToSync)) {
            return
        }
        console.log(`• Slowest Tables: `)
        var items = Object.keys(tableTimeToSync).map(function (key) {
            return [key, tableTimeToSync[key]]
        })
        items.sort(function (first, second) {
            return second[1] - first[1]
        })
        for (var i = 0; i < Math.min(items.length, 5); i++) {
            console.log(`  • ${items[i][0]} - ${chalk_1.default.yellow(items[i][1] + 's')}`)
        }
    }
    async syncTable(table) {
        const tableData = this.tables[table]
        return new Promise(async (resolve, reject) => {
            try {
                const _stream = await this.streamingMergeCopy(tableData)
                _stream.stdout.pipe((0, split2_1.default)()).on(`data`, (d) => {
                    process.stdout.write(` `)
                })
                _stream.stderr.on(`data`, (d) => {
                    process.stderr.write(d)
                })
                _stream.on(`close`, () => {
                    resolve()
                })
            } catch (e) {
                console.error(e.message)
                process.exit()
            }
        })
    }
    async truncateLocalTargetTables() {
        try {
            await this.pool.local.query('SET client_min_messages TO WARNING;')
            for (const table of this.config.tables) {
                await this.pool.local.query(`TRUNCATE TABLE "${table}" CASCADE;`)
            }
            await this.pool.local.query('SET client_min_messages TO DEFAULT;')
        } catch (e) {
            throw e
        }
    }
}
exports.default = SyncTables
