import chalk from 'chalk'
import _ from 'lodash'

import * as constants from '../constants'
import { sleep, Spinner } from '../helpers'
import PostgrabBaseClass from './base'

const MAX_ROWS_PER_FETCH = 1000

export default class Watch extends PostgrabBaseClass {
    private tableStatus: { [key: string]: Function } = {}
    private initialRowCount: { [key: string]: number } = {}
    private lastBookmarkValue: { [key: string]: any } = {} // Store the last known bookmark value for each table

    async run() {
        // Initialize lastBookmarkValue for each table
        await Promise.all(
            _.map(this.config.tables, async (table) => {
                this.lastBookmarkValue[table] = await this.getLocalMaxForTable(table)
                this.initialRowCount[table] = await this.getRowCount(
                    table,
                    this.lastBookmarkValue[table],
                )
            }),
        )

        console.log(this.initialRowCount)

        // Init an updatable log line and a row count for each table so that we can
        // keep track of/display their ongoing progress
        _.forEach(this.config.tables, (table) => {
            this.tableStatus[table] = this.draft()
            const spinner = new Spinner()
            setInterval(async () => {
                const currentRowCount = await this.getRowCount(table, this.lastBookmarkValue[table])
                const diffRowCount = currentRowCount - this.initialRowCount[table]
                this.tableStatus[table](
                    `${spinner.spin()} ${chalk.blue.underline(table)} — pulled ${chalk.green(
                        String(diffRowCount),
                    )} total`,
                )
                // Update the initial row count to the current for the next interval
                this.initialRowCount[table] = currentRowCount
            }, constants.LOG_LINE_UPDATE_INTERVAL_MS)
        })

        // Start an infinite loop during which we continually get new rows from all
        // watched tables and then sleep for the configured duration between each run
        while (true) {
            await Promise.all(_.map(this.config.tables, (table) => this.getNewRowsForTable(table)))
            await sleep(this.config.watchIntervalSeconds * 1000)
        }
    }

    // Modified getRowCount method to use the bookmark
    async getRowCount(table: string, lastBookmarkValue: any): Promise<number> {
        const bookmarkColumn = this.config.bookmarks[table]
        const SCHEMA_AND_TABLE = `"${this.config.schema}"."${table}"`
        const query = `SELECT COUNT(*) AS count FROM ${SCHEMA_AND_TABLE} WHERE "${bookmarkColumn}" > $1`
        try {
            const res = await this.pool['remote'].query(query, [lastBookmarkValue])
            return parseInt(res.rows[0].count, 10)
        } catch (error) {
            console.error(
                chalk.red(`Error getting row count for table ${chalk.white(table)}`),
                error,
            )
            process.exit(1)
        }
    }

    async getNewRowsForTable(table: string) {
        const bookmark = this.config.bookmarks[table]
        if (!bookmark) {
            console.error(
                chalk.red(
                    `You haven't configured a bookmark column for the ${chalk.white(table)} table`,
                ),
            )
            process.exit()
        }

        const remoteConditions = await this.getRemoteWhereClauseForTable(table)
        const SCHEMA_AND_TABLE = `"${this.config.schema}"."${table}"`
        const timeout = 600000 // 10 minutes

        const remoteCmd = `
      BEGIN; SET statement_timeout TO ${timeout}; COMMIT;
      COPY (SELECT *
              FROM ${SCHEMA_AND_TABLE} ${remoteConditions || ''}
          ORDER BY ${bookmark} DESC NULLS LAST
             LIMIT ${MAX_ROWS_PER_FETCH}
      ) TO STDOUT
    `

        const _stream = await this.streamingMergeCopy(this.tables[table], remoteCmd)

        return await new Promise((resolve, reject) => {
            _stream.stderr.on(`data`, (data) => process.stderr.write(data))

            _stream.on(`close`, resolve)
        })
    }
}
