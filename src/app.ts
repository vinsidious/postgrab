import chalk from 'chalk'
import configYaml from 'config-yaml'
import findUp from 'findup-sync'
import fs from 'fs'
import _ from 'lodash'
import path from 'path'
import RJSON from 'relaxed-json'

import * as constants from './constants'
import * as defaults from './defaults'
import { args, encodeConnectionParameters, exec, isEnvironmentVariable, isPgUri } from './helpers'
import { ConnectionParameters, NormalObject, PostgrabConfig } from './interfaces'
import Postgrab from './postgrab'

const CONFIG_TEMPLATE_PATH = path.join(__dirname, `..`, constants.CONFIG_TEMPLATE_PATH)

export class App {
    args: any
    config: PostgrabConfig

    constructor() {
        this.args = args()
    }

    async initialize() {
        const configFilepath = this.findConfigFile(this.args.config)
        const configFile = this.parseConfigFile(configFilepath)

        const userArgs = _.pick(this.args, [
            `metrics`,
            `schemaOnly`,
            `maxWorkers`,
            `init`,
            `local`,
            `remote`,
            `tables`,
            `groups`,
            `watch`,
            `exclude`,
            `partials`,
            `schema`,
            `setup`,
            `truncate`,
        ])

        this.config = await this.mergeConfigFileWithUserArgs(configFile, userArgs)
        this.config.configFilepath = configFilepath

        return new Postgrab(this.config)
    }

    /**
     * Does the work of merging the config values stores in the user's
     * '.postgrab.yaml' file with the CLI args passed in at runtime.
     *
     * @todo Add some basic validation so that we blow up on conflicting/mutually
     * exclusive arguments (i.e. specifying both "tables" and "watch")
     */
    async mergeConfigFileWithUserArgs(configFile: any, userArgs: any): Promise<PostgrabConfig> {
        const [local, remote] = await Promise.all([
            this.parseDbParams(userArgs.local || configFile.local),
            this.parseDbParams(userArgs.remote || configFile.remote),
        ])

        // If the user specifies their desired tables via the `--tables` or
        // `--groups` CLI flags, then we'll _only_ dump those tables. Otherwise,
        // we'll dump all tables within .postgrab.yaml where `dump` is `true`.
        let tables = []

        if (_.size(userArgs.tables)) tables.push(...userArgs.tables)

        const setup = userArgs.setup || configFile.setup
        const maxWorkers = ~~(userArgs.maxWorkers || configFile.max_workers || defaults.MAX_WORKERS)
        const watchIntervalSeconds =
            configFile.watch_interval_seconds || defaults.WATCH_INTERVAL_SECONDS
        const schema = userArgs.schema || configFile.schema || defaults.SCHEMA_NAME
        const schemaOnly = !!userArgs.schemaOnly
        const metrics = !!userArgs.metrics
        const truncate = !!userArgs.truncate
        const watch = !!userArgs.watch
        const init = !!userArgs.init
        const exclude = _.size(userArgs.exclude)
            ? userArgs.exclude
            : _.keys(_.pickBy(configFile.tables, (table) => table && table.dump === false))

        // If the user provides specific table groups, look them up in the config
        // file and add those tables
        if (_.size(userArgs.groups)) {
            _.forEach(userArgs.groups, (groupName) => {
                const group = _.get(configFile, `groups.${groupName}`) as string[]
                if (!group) {
                    console.error(
                        chalk.red(
                            `\nCouldn't find the group ${chalk.white(groupName)} in the provided config file`,
                        ),
                    )
                    console.error(
                        `\nTip: Groups must be defined beforehand in your .postgrab.yaml before you can reference them as CLI args`,
                    )
                    process.exit()
                }
                tables = _.union(tables, group)
            })
        }

        const partials = this.removeUndefinedValuesFromObject({
            ..._.mapValues(configFile.tables, `partial`),
            ...userArgs.partials,
        })
        const bookmarks = _.mapValues(configFile.tables, `bookmark`)

        const withStatements = this.convertPartialsIntoCTE(partials, schema)

        return {
            configFile,
            exclude,
            local,
            maxWorkers,
            partials,
            bookmarks,
            remote,
            init,
            schema,
            schemaOnly,
            metrics,
            setup,
            tables,
            truncate,
            watch,
            watchIntervalSeconds,
            withStatements,
        }
    }

    removeUndefinedValuesFromObject(obj: NormalObject) {
        _.forIn(obj, (val, key) => {
            if (_.isUndefined(val)) {
                delete obj[key]
            }
        })

        return obj
    }

    convertPartialsIntoCTE(partials: NormalObject, schema: string) {
        const withStatements = {}

        const unorderedDependencyMap = _.map(partials, (partial, table) => {
            const dependencies = _.map(partial.match(constants.PARTIAL_REF_REGEX), (partial) =>
                partial.replace(/\W/g, ''),
            )
            return { table, dependencies }
        })

        // We need to take the `unorderedDependencyMap` and put it in proper dependency order.
        const orderedDependencyMap = []

        while (_.size(unorderedDependencyMap)) {
            // Create an array of the tables which we've already put in order in our `orderedDependencyMap`
            const alreadyOrderedTables = _.map(orderedDependencyMap, 'table')
            const nextItem = _.find(
                unorderedDependencyMap,
                ({ table, dependencies }) =>
                    _.isEmpty(dependencies) ||
                    _.isEmpty(_.difference(dependencies, alreadyOrderedTables)),
            )
            if (!nextItem) {
                console.error(
                    chalk.red(
                        `\nYou have a cyclic dependency in your partials, please address before continuing.\n`,
                    ),
                )
                process.exit()
            }

            _.remove(unorderedDependencyMap, nextItem)

            const expandedDependencies = (function recurseDependencies(
                { table, dependencies }: any = {},
                deps = [],
            ) {
                if (!table) return
                deps.push(table)
                _.forEach(dependencies, (dep) =>
                    recurseDependencies(_.find(orderedDependencyMap, { table: dep }), deps),
                )
                return _.uniq(deps)
            })(nextItem)

            orderedDependencyMap.push({
                table: nextItem.table,
                // This just makes sure that we list the dependencies in the proper order.
                dependencies: _.filter(alreadyOrderedTables, (table) =>
                    _.includes(expandedDependencies, table),
                ),
            })
        }

        // Convert all the '{{ shipments }}' syntax in partials to regular table names.
        _.forIn(partials, (partial, table) => {
            partials[table] = partial.replace(constants.PARTIAL_REF_REGEX, '$1')
        })

        // Generate a `WITH` statement for each table that depends on other tables with partials.
        _.forEach(orderedDependencyMap, ({ table, dependencies }) => {
            if (_.isEmpty(dependencies)) return (withStatements[table] = '')
            const withStatement = _.map(
                dependencies,
                (table) => `${table} AS (SELECT * FROM "${schema}"."${table}" ${partials[table]})`,
            ).join(',\n')
            withStatements[table] = `WITH ${withStatement}`
        })

        return withStatements
    }

    parseConfigFile(filepath: string) {
        try {
            return configYaml(filepath)
        } catch (e) {
            console.error(
                chalk.red(`\nUnable to parse config file located at ${chalk.white(filepath)}`),
            )
            console.error(`\nTip: Make sure your YAML is 100% YAMLy`)
            process.exit()
        }
    }

    /**
     * Resolves the local or remote db connection parameters by checking their
     * type and incrementally coercing them into a connection string/URI.
     */
    async parseDbParams(params: null | string | ConnectionParameters): Promise<string> {
        if (_.isNil(params)) return ``

        if (typeof params === 'object') {
            _.forIn(params, (v, k, o) => {
                if (isEnvironmentVariable(String(v))) {
                    o[k] = process.env[String(v).slice(1)]
                }
            })
            return encodeConnectionParameters(params)
        } else if (isPgUri(params)) {
            return params
        }

        // Assume the user provided a command that must be executed and will return
        // a connection string or object
        try {
            const paramsResult = await exec(params)
            if (isPgUri(paramsResult)) return paramsResult
            try {
                const objectParams = RJSON.parse(paramsResult)
                return encodeConnectionParameters(objectParams)
            } catch (e) {
                console.error(
                    chalk.red(`\nUnable to derive a connection string from the provided command`),
                )
                console.error(
                    chalk.red(
                        `\nThe provided command output: ${chalk.white(_.trim(paramsResult))}`,
                    ),
                )
                process.exit()
            }
        } catch (e) {
            console.error(chalk.red(`\n${e}\n`))
            process.exit()
        }
    }

    /**
     * Either returns the user's specified path to their '.postgrab.yaml' or walks
     * up the file tree looking for a file that matches our glob pattern (the
     * pattern just checks for '.ya*ml' so both '.yaml' and '.yml' will match).
     */
    findConfigFile(filepath?: string): any {
        filepath = filepath || findUp(constants.CONFIG_FILENAME_GLOB)
        if (!filepath) {
            this.generateConfigFile()
            console.error(
                chalk.yellow(
                    `\nUnable to find config file. Creating a generic ${chalk.white(
                        `.postgrab.yaml`,
                    )} file in the current directory\n`,
                ),
            )
            console.error(
                `\nAdd your connection details to '.postgrab.yaml' and then run ${chalk.green(
                    `postgrab --init`,
                )} ` + `to begin the interactive configuration process\n`,
            )
            process.exit()
        }
        return filepath
    }

    /**
     * Generates a basic config file in the current directory, logs the new file's
     * path, and then exits.
     */
    generateConfigFile(silent = true) {
        const OUTPUT_PATH = path.join(process.cwd(), constants.CONFIG_FILENAME)
        const configTemplate = fs.readFileSync(CONFIG_TEMPLATE_PATH, `utf-8`)
        fs.writeFileSync(OUTPUT_PATH, configTemplate)
        !silent &&
            console.log(
                `\nSuccessfully created config file located at '${chalk.green(OUTPUT_PATH)}'\n`,
            )
    }
}
