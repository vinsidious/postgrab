'use strict'
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
const lodash_1 = __importDefault(require('lodash'))
const commander_1 = require('commander')
const yargs_1 = __importDefault(require('yargs'))
const helpers_1 = require('yargs/helpers')
const fs_1 = require('fs')
const path_1 = require('path')
function getProjectVersion() {
    const packageJsonPath = (0, path_1.join)(__dirname, '../..', 'package.json')
    const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'))
    return packageJson.version
}
const version = getProjectVersion()
const program = new commander_1.Command()
function args() {
    const commanderArgs = getArgsFromCommander()
    const { tables, ...cliArgs } = getArgsFromCLI()
    const partials = lodash_1.default.filter(tables, (table) => table.match(/\s/))
    lodash_1.default.pullAll(tables, partials)
    return {
        ...commanderArgs,
        ...cliArgs,
        tables,
        partials: partials.length ? { [tables[0]]: partials[0] } : null,
    }
}
exports.default = args
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
    const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
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
    if (argv._?.length) {
        argv.tables = maybeSplit(lodash_1.default.head(argv._))
    }
    return lodash_1.default.mapValues(argv, (value) => {
        return lodash_1.default.isArray(value) ? lodash_1.default.flattenDeep(value) : value
    })
}
function maybeSplit(value) {
    if (lodash_1.default.isString(value)) {
        return value.match(/\s/) ? [value] : lodash_1.default.compact(value.split(','))
    }
    return lodash_1.default.flatMap(value, maybeSplit)
}
