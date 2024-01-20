'use strict'
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
const chalk_1 = __importDefault(require('chalk'))
const child_process_1 = require('child_process')
const lodash_1 = __importDefault(require('lodash'))
const helpers_1 = require('../helpers')
const interfaces_1 = require('../interfaces')
const base_1 = __importDefault(require('./base'))
class SyncSchema extends base_1.default {
    async run() {
        const skipTables = lodash_1.default.difference(this.remoteTableNames, this.config.tables)
        const skipTableArgs = lodash_1.default.flatMap(skipTables, (table) => [`-T`, `"${table}"`])
        try {
            await this.dropNecessaryTables()
            const missingExtensions = await this.findMissingExtensions()
            if (missingExtensions.length) {
                this.status.start(
                    `Installing missing extensions: ${chalk_1.default.green(missingExtensions.join(chalk_1.default.white(`, `)))}`,
                )
                const installExtensionsCmds = lodash_1.default
                    .map(missingExtensions, (ext) => `CREATE EXTENSION IF NOT EXISTS "${ext}";`)
                    .join(` `)
                await this.query.local(installExtensionsCmds)
            }
        } catch (e) {
            this.errorAndExit(e)
        }
        try {
            this.status.start(`Syncing local/remote schema`)
            const remoteStream = (0, child_process_1.spawn)(`pg_dump`, [
                `-Fc`,
                `-Oxs`,
                `-n`,
                this.config.schema,
                ...skipTableArgs,
                `-d`,
                this.config.remote,
            ])
            const localStream = (0, child_process_1.spawn)(`pg_restore`, [
                `-Oxs`,
                `-d`,
                this.config.local,
            ])
            remoteStream.stdout.pipe(localStream.stdin)
            await new Promise((resolve) => localStream.stdout.on('close', resolve))
            this.status.succeed()
        } catch (e) {}
    }
    async dropNecessaryTables(count = 1) {
        if (this.config.tables.length === this.remoteTableNames.length) {
            try {
                const { database } = (0, helpers_1.parseConnectionString)(this.config.local)
                this.pool.local && (await this.pool.local.end())
                delete this.pool.local
                this.status.start(
                    `Terminating all open connections to '${database}' (attempt ${count})`,
                )
                await this.terminateOpenConnections()
                const { host, port } = (0, helpers_1.parseConnectionString)(this.config.local)
                this.status.start(`Dropping and recreating '${database}' (attempt ${count})`)
                await (0, helpers_1.exec)(`dropdb -h ${host} -p ${port} --if-exists ${database}`)
                await (0, helpers_1.exec)(`createdb -h ${host} -p ${port} ${database}`)
                this.createPool(interfaces_1.DatabaseSource.LOCAL)
            } catch (e) {
                if (/accessed by other users/i.test(e))
                    return await this.dropNecessaryTables(count + 1)
                this.errorAndExit(e)
            }
        } else {
            this.status.start(`Dropping ${this.config.tables.length} tables`)
            const dropCommands = lodash_1.default
                .map(this.config.tables, (table) => `DROP TABLE IF EXISTS "${table}" CASCADE;`)
                .join(` `)
            await this.query.local(dropCommands)
        }
    }
    errorAndExit(error) {
        console.error(
            chalk_1.default.red(`\nEncountered the following error while syncing schema\n`),
        )
        console.error(error)
        process.exit()
    }
    async terminateOpenConnections() {
        const { database } = (0, helpers_1.parseConnectionString)(this.config.local)
        const child = (0, child_process_1.spawn)(`psql`, [`-d`, this.config.local])
        return await new Promise((resolve) => {
            ;(0, helpers_1.bufferToStream)(
                new Buffer(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
         WHERE datname = '${database}'
           AND pid <> pg_backend_pid()
      `),
            )
                .on(`end`, resolve)
                .pipe(child.stdin)
        })
    }
    async findMissingExtensions() {
        const queryString = `SELECT name FROM pg_available_extensions WHERE installed_version IS NOT NULL`
        const [remoteExtensions, localExtensions] = await Promise.all([
            this.query.remote(queryString).then((rows) => lodash_1.default.map(rows, `name`)),
            this.query.local(queryString).then((rows) => lodash_1.default.map(rows, `name`)),
        ])
        return lodash_1.default.difference(remoteExtensions, localExtensions)
    }
}
exports.default = SyncSchema
