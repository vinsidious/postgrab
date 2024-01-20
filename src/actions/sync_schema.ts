import chalk from 'chalk';
import { spawn } from 'child_process';
import _ from 'lodash';

import {
  bufferToStream,
  exec,
  parseConnectionString,
} from '../helpers';
import { DatabaseSource } from '../interfaces';
import PostgrabBaseClass from './base';

export default class SyncSchema extends PostgrabBaseClass {
  async run() {
    const skipTables = _.difference(this.remoteTableNames, this.config.tables);
    const skipTableArgs = _.flatMap(skipTables, table => [`-T`, `"${table}"`]);

    try {
      // First we need to drop the target tables. If we're syncing the schema
      // for 100% of tables, we'll just drop/recreate the entire database,
      // otherwise we'll drop specific tables. The reason we drop the entire
      // database is because it's much less error-prone than dropping specific
      // tables. This is due to relational dependencies like extensions, etc.
      await this.dropNecessaryTables();

      // Install any extensions that exist remotely but are missing locally
      const missingExtensions = await this.findMissingExtensions();
      if (missingExtensions.length) {
        this.status.start(
          `Installing missing extensions: ${chalk.green(missingExtensions.join(chalk.white(`, `)))}`,
        );
        const installExtensionsCmds = _.map(
          missingExtensions,
          ext => `CREATE EXTENSION IF NOT EXISTS "${ext}";`,
        ).join(` `);
        await this.query.local(installExtensionsCmds);
      }
    } catch (e) {
      this.errorAndExit(e);
    }

    try {
      this.status.start(`Syncing local/remote schema`);

      const remoteStream = spawn(`pg_dump`, [
        `-Fc`,
        `-Oxs`,
        `-n`,
        this.config.schema,
        ...skipTableArgs,
        `-d`,
        this.config.remote,
      ]);
      const localStream = spawn(`pg_restore`, [`-Oxs`, `-d`, this.config.local]);
      remoteStream.stdout.pipe(localStream.stdin);
      await new Promise(resolve => localStream.stdout.on('close', resolve));

      this.status.succeed();
    } catch (e) {
      // Swallow all restore errors for now. We need to "attempt" to create
      // things that already exist which results in several errors.
    }
  }

  private async dropNecessaryTables(count = 1) {
    if (this.config.tables.length === this.remoteTableNames.length) {
      // We run into complications with some operations if we don't first
      // terminate all active connections to the target database. Some connected
      // clients are resilient and immediately attempt to reconnect, so we'll
      // keep retrying until they give up
      try {
        const { database } = parseConnectionString(this.config.local);

        this.pool.local && (await this.pool.local.end());
        delete this.pool.local;

        this.status.start(`Terminating all open connections to '${database}' (attempt ${count})`);
        await this.terminateOpenConnections();

        const { host, port } = parseConnectionString(this.config.local);

        this.status.start(`Dropping and recreating '${database}' (attempt ${count})`);
        await exec(`dropdb -h ${host} -p ${port} --if-exists ${database}`);
        await exec(`createdb -h ${host} -p ${port} ${database}`);

        this.createPool(DatabaseSource.LOCAL);
      } catch (e) {
        if (/accessed by other users/i.test(e)) return await this.dropNecessaryTables(count + 1);
        this.errorAndExit(e);
      }
    } else {
      this.status.start(`Dropping ${this.config.tables.length} tables`);
      const dropCommands = _.map(
        this.config.tables,
        table => `DROP TABLE IF EXISTS "${table}" CASCADE;`,
      ).join(` `);
      await this.query.local(dropCommands);
    }
  }

  private errorAndExit(error: Error) {
    console.error(chalk.red(`\nEncountered the following error while syncing schema\n`));
    console.error(error);
    process.exit();
  }

  private async terminateOpenConnections() {
    const { database } = parseConnectionString(this.config.local);
    const child = spawn(`psql`, [`-d`, this.config.local]);
    return await new Promise(resolve => {
      bufferToStream(
        new Buffer(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
         WHERE datname = '${database}'
           AND pid <> pg_backend_pid()
      `),
      )
        .on(`end`, resolve)
        .pipe(child.stdin);
    });
  }

  private async findMissingExtensions() {
    const queryString = `SELECT name FROM pg_available_extensions WHERE installed_version IS NOT NULL`;
    const [remoteExtensions, localExtensions] = await Promise.all([
      this.query.remote(queryString).then(rows => _.map(rows, `name`)),
      this.query.local(queryString).then(rows => _.map(rows, `name`)),
    ]);
    return _.difference(remoteExtensions, localExtensions);
  }
}
