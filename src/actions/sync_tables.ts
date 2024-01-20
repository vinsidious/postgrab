import approx from 'approximate-number'
import chalk from 'chalk'
import { spawn } from 'child_process'
import _ from 'lodash'
import path from 'path'
import pluralize from 'pluralize'
import split2 from 'split2'

import * as constants from '../constants'
import { sleep, Spinner } from '../helpers'
import { DatabaseSource, NormalObject } from '../interfaces'
import PostgrabBaseClass from './base'

const tableTimeToSync = {}

export async function worker() {
    const config = JSON.parse(process.env.CONFIG)
    const table = process.env.TABLE
    const worker = new SyncTables(config)
    worker.tables = JSON.parse(process.env.ALL_TABLES)
    await worker.syncTable(table)
}

export default class SyncTables extends PostgrabBaseClass {
    private workers: string[] = []
    private workerCount: number
    private whereClauses: NormalObject = {}
    private remoteRowCounts: NormalObject = {}

    async run() {
        await this.checkForTablesLocally()
        if (this.config.truncate) await this.truncateLocalTargetTables()

        const tableCount = this.config.tables.length
        this.workerCount = _.min([this.config.maxWorkers, tableCount])
        this.workers = new Array(this.workerCount).fill(`WORKER`)
        this.status.info(
            `Syncing ${pluralize('table', tableCount, true)} across ${pluralize(
                'worker',
                this.workerCount,
                true,
            )}`,
        )

        await this.runMaster()

        if (this.config.metrics) {
            this.printMetrics()
        }
    }

    private async runMaster() {
        return new Promise<void>(async (resolve, reject) => {
            while (this.config.tables.length || this.workers.length !== this.workerCount) {
                await sleep(5)
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

    private async spawnWorkerForTable(worker: string, table: string) {
        const startTime = new Date()

        let count = 0,
            remoteCount,
            localCount = 1,
            whereClause = ``

        const syncInfoString = ` Syncing ${chalk.blue.underline(table)}${
            whereClause ? chalk.dim(` <partial>`) : ``
        }`
        const status = this.draft(syncInfoString)
        const spinner = new Spinner()
        const interval = setInterval(() => {
            status(
                spinner.spin() +
                    syncInfoString +
                    ` [${chalk.green(String(_.round(100 * (count / (remoteCount || 1)))))}%]`,
            )
        }, constants.LOG_LINE_UPDATE_INTERVAL_MS)

        whereClause = this.whereClauses[table] = await this.getRemoteWhereClauseForTable(table)
        ;[localCount, remoteCount] = await Promise.all([
            this.getCountForTableAndSource(table, DatabaseSource.LOCAL),
            this.getCountForTableAndSource(table, DatabaseSource.REMOTE),
        ])

        if (localCount >= remoteCount) {
            status(
                chalk.green(`✔ `) + `No new rows to dump for ${chalk.blue.underline(table)} table`,
            )
            this.workers.push(worker)
            clearInterval(interval)
            return
        }

        const execString = `require('${path.join(__dirname, '../../dist/actions/index.js')}').worker().then(process.exit)`
        const child = spawn(process.execPath, [`-e`, execString], {
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
                const timeToSync = _.round((+new Date() - +startTime) / 1000)
                tableTimeToSync[table] = timeToSync
                status(
                    chalk.green(`✔`) +
                        syncInfoString +
                        ` [${approx(remoteCount)} rows — ` +
                        `${chalk.yellow(timeToSync + 's')}]`,
                )
                resolve(this.workers.push(worker))
            })

            child.on(`error`, (error) => {
                console.log(chalk.red(`Error encountered: ${chalk.white(error.toString())}`))
                process.exit()
            })

            child.stderr.on(`data`, (data) => {
                console.log(chalk.red(`Error encountered: ${chalk.white(data.toString())}`))
            })

            child.stdout.on(`data`, (data) => {
                count += data.length
            })
        })
    }

    async getCountForTableAndSource(table: string, source: DatabaseSource) {
        const withStatement = this.config.withStatements[table]
        return await this.query[source](
            `${withStatement ? withStatement : ''}
      SELECT COUNT(*)
        FROM "${this.config.schema}"."${table}"${
            this.whereClauses[table] ? ` ${this.whereClauses[table]}` : ``
        }
    `,
        ).then((rows) => ~~_.get(rows, `0.count`, 0))
    }

    async localAndRemoteCountsMatch(table: string) {
        const localCount = await this.getCountForTableAndSource(table, DatabaseSource.LOCAL)
        return localCount === this.remoteRowCounts[table]
    }

    private printMetrics() {
        if (_.isEmpty(tableTimeToSync)) {
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
            console.log(`  • ${items[i][0]} - ${chalk.yellow(items[i][1] + 's')}`)
        }
    }

    async syncTable(table: string): Promise<any> {
        const tableData = this.tables[table]
        return new Promise<void>(async (resolve, reject) => {
            try {
                const _stream = await this.streamingMergeCopy(tableData)
                _stream.stdout.pipe(split2()).on(`data`, (d) => {
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

    private async truncateLocalTargetTables() {
        try {
            await this.pool.local.query('BEGIN')

            // Set client_min_messages to WARNING to silence NOTICE messages
            await this.pool.local.query('SET client_min_messages TO WARNING;')

            // Truncate tables with CASCADE to also truncate dependent tables
            for (const table of this.config.tables) {
                await this.pool.local.query(`TRUNCATE TABLE "${table}" CASCADE;`)
            }

            // Reset client_min_messages to default value (or you can set it to a specific level you want)
            await this.pool.local.query('SET client_min_messages TO DEFAULT;')

            await this.pool.local.query('COMMIT')
        } catch (e) {
            await this.pool.local.query('ROLLBACK')
            throw e
        }
    }
}
