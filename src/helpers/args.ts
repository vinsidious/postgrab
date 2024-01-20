import _ from 'lodash'
import { Command } from 'commander'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { readFileSync } from 'fs'
import { join } from 'path'

function getProjectVersion() {
    const packageJsonPath = join(__dirname, '../..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version
}

const version = getProjectVersion()

const program = new Command()

export default function args(): any {
    const commanderArgs = getArgsFromCommander()
    const { tables, ...cliArgs } = getArgsFromCLI() as any
    const partials = _.filter(tables, (table: string) => table.match(/\s/))
    _.pullAll(tables, partials)

    return {
        ...commanderArgs,
        ...cliArgs,
        tables,
        partials: partials.length ? { [tables[0] as string]: partials[0] } : null,
    }
}

function getArgsFromCommander() {
    program
        .version(version)
        .option(`-i, --init`, `Initiate interactive configuration`, () => true, false)
        .option(`-s, --schema-only`, `Sync schema only`, () => true, false)
        .option(`-M, --metrics`, `Print sync metrics`, () => true, false)
        .option(`-T, --truncate`, `Truncate local target tables when syncing`, () => true, false)
        .option(`-t, --tables <tables>`, `A list of tables to sync`, maybeSplit, [])
        .option(`-g, --groups <groups>`, `A list of groups to sync`, maybeSplit, [])
        .option(
            `-m, --max-workers <count>`,
            `Limit the number of parallel workers used to sync tables (defaults to number of cores)`,
        )
        .option(
            `-p, --setup <command>`,
            `Optionally specify a command that postgrab will run prior to connecting/syncing any tables`,
        )
        .option(
            `-l, --local <uri|command>`,
            `Local database connection string or a command which returns a connection string or config object`,
        )
        .option(
            `-r, --remote <uri|command>`,
            `Remote database connection string or a command which returns a connection string or config object`,
        )
        .option(
            `-c, --config <path>`,
            `Path to postgrab config file (by default, postgrab will traverse upward until it finds '.postgrab.yaml')`,
        )
        .option(`-e, --exclude <tables>`, `A list of tables to exclude`, maybeSplit, [])
        .option(`-S, --schema <name>`, `The schema to sync (will use 'public' by default)`)

    return program.parse(process.argv)
}

function getArgsFromCLI() {
    const argv = yargs(hideBin(process.argv))
        .option('tables', {
            alias: 't',
            type: 'array',
            coerce: maybeSplit,
        })
        .option('groups', {
            alias: 'g',
            type: 'array',
            coerce: maybeSplit,
        })
        .option('exclude', {
            alias: 'e',
            type: 'array',
            coerce: maybeSplit,
        })
        .option('metrics', {
            alias: 'M',
            type: 'boolean',
        })
        .option('max-workers', {
            alias: 'm',
            type: 'number',
        })
        .option('setup', {
            alias: 'p',
            type: 'string',
        })
        .option('local', {
            alias: 'l',
            type: 'string',
        })
        .option('remote', {
            alias: 'r',
            type: 'string',
        })
        .option('config', {
            alias: 'c',
            type: 'string',
        })
        .option('schema', {
            alias: 'S',
            type: 'string',
        })
        .option('init', {
            alias: 'i',
            type: 'boolean',
        })
        .option('truncate', {
            alias: 'T',
            type: 'boolean',
        })
        .option('schema-only', {
            alias: 's',
            type: 'boolean',
        })
        .parse()

    // Handle unknown arguments as tables
    if ((argv as any)._?.length) {
        ;(argv as any).tables = maybeSplit(_.head((argv as any)._))
    }

    // Flatten arrays in the arguments
    return _.mapValues(argv, (value) => {
        return _.isArray(value) ? _.flattenDeep(value) : value
    })
}

function maybeSplit(value) {
    if (_.isString(value)) {
        return value.match(/\s/) ? [value] : _.compact(value.split(','))
    }
    return _.flatMap(value, maybeSplit)
}
