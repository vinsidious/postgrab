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
exports.App = void 0
const chalk_1 = __importDefault(require('chalk'))
const config_yaml_1 = __importDefault(require('config-yaml'))
const findup_sync_1 = __importDefault(require('findup-sync'))
const fs_1 = __importDefault(require('fs'))
const lodash_1 = __importDefault(require('lodash'))
const path_1 = __importDefault(require('path'))
const relaxed_json_1 = __importDefault(require('relaxed-json'))
const constants = __importStar(require('./constants'))
const defaults = __importStar(require('./defaults'))
const helpers_1 = require('./helpers')
const postgrab_1 = __importDefault(require('./postgrab'))
const CONFIG_TEMPLATE_PATH = path_1.default.join(__dirname, `..`, constants.CONFIG_TEMPLATE_PATH)
class App {
    constructor() {
        this.args = (0, helpers_1.args)()
    }
    async initialize() {
        const configFilepath = this.findConfigFile(this.args.config)
        const configFile = this.parseConfigFile(configFilepath)
        const userArgs = lodash_1.default.pick(this.args, [
            `metrics`,
            `schemaOnly`,
            `maxWorkers`,
            `init`,
            `local`,
            `remote`,
            `tables`,
            `groups`,
            `exclude`,
            `partials`,
            `schema`,
            `setup`,
            `truncate`,
        ])
        this.config = await this.mergeConfigFileWithUserArgs(configFile, userArgs)
        this.config.configFilepath = configFilepath
        return new postgrab_1.default(this.config)
    }
    async mergeConfigFileWithUserArgs(configFile, userArgs) {
        const [local, remote] = await Promise.all([
            this.parseDbParams(userArgs.local || configFile.local),
            this.parseDbParams(userArgs.remote || configFile.remote),
        ])
        let tables = []
        if (lodash_1.default.size(userArgs.tables)) tables.push(...userArgs.tables)
        const setup = userArgs.setup || configFile.setup
        const maxWorkers = ~~(userArgs.maxWorkers || configFile.max_workers || defaults.MAX_WORKERS)
        const schema = userArgs.schema || configFile.schema || defaults.SCHEMA_NAME
        const schemaOnly = !!userArgs.schemaOnly
        const metrics = !!userArgs.metrics
        const truncate = !!userArgs.truncate
        const init = !!userArgs.init
        const exclude = lodash_1.default.size(userArgs.exclude)
            ? userArgs.exclude
            : lodash_1.default.keys(
                  lodash_1.default.pickBy(
                      configFile.tables,
                      (table) => table && table.dump === false,
                  ),
              )
        if (lodash_1.default.size(userArgs.groups)) {
            lodash_1.default.forEach(userArgs.groups, (groupName) => {
                const group = lodash_1.default.get(configFile, `groups.${groupName}`)
                if (!group) {
                    console.error(
                        chalk_1.default.red(
                            `\nCouldn't find the group ${chalk_1.default.white(groupName)} in the provided config file`,
                        ),
                    )
                    console.error(
                        `\nTip: Groups must be defined beforehand in your .postgrab.yaml before you can reference them as CLI args`,
                    )
                    process.exit()
                }
                tables = lodash_1.default.union(tables, group)
            })
        }
        const partials = this.removeUndefinedValuesFromObject({
            ...lodash_1.default.mapValues(configFile.tables, `partial`),
            ...userArgs.partials,
        })
        const bookmarks = lodash_1.default.mapValues(configFile.tables, `bookmark`)
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
            withStatements,
        }
    }
    removeUndefinedValuesFromObject(obj) {
        lodash_1.default.forIn(obj, (val, key) => {
            if (lodash_1.default.isUndefined(val)) {
                delete obj[key]
            }
        })
        return obj
    }
    convertPartialsIntoCTE(partials, schema) {
        const withStatements = {}
        const unorderedDependencyMap = lodash_1.default.map(partials, (partial, table) => {
            const dependencies = lodash_1.default.map(
                partial.match(constants.PARTIAL_REF_REGEX),
                (partial) => partial.replace(/\W/g, ''),
            )
            return { table, dependencies }
        })
        const orderedDependencyMap = []
        while (lodash_1.default.size(unorderedDependencyMap)) {
            const alreadyOrderedTables = lodash_1.default.map(orderedDependencyMap, 'table')
            const nextItem = lodash_1.default.find(
                unorderedDependencyMap,
                ({ table, dependencies }) =>
                    lodash_1.default.isEmpty(dependencies) ||
                    lodash_1.default.isEmpty(
                        lodash_1.default.difference(dependencies, alreadyOrderedTables),
                    ),
            )
            if (!nextItem) {
                console.error(
                    chalk_1.default.red(
                        `\nYou have a cyclic dependency in your partials, please address before continuing.\n`,
                    ),
                )
                process.exit()
            }
            lodash_1.default.remove(unorderedDependencyMap, nextItem)
            const expandedDependencies = (function recurseDependencies(
                { table, dependencies } = {},
                deps = [],
            ) {
                if (!table) return
                deps.push(table)
                lodash_1.default.forEach(dependencies, (dep) =>
                    recurseDependencies(
                        lodash_1.default.find(orderedDependencyMap, { table: dep }),
                        deps,
                    ),
                )
                return lodash_1.default.uniq(deps)
            })(nextItem)
            orderedDependencyMap.push({
                table: nextItem.table,
                dependencies: lodash_1.default.filter(alreadyOrderedTables, (table) =>
                    lodash_1.default.includes(expandedDependencies, table),
                ),
            })
        }
        lodash_1.default.forIn(partials, (partial, table) => {
            partials[table] = partial.replace(constants.PARTIAL_REF_REGEX, '$1')
        })
        lodash_1.default.forEach(orderedDependencyMap, ({ table, dependencies }) => {
            if (lodash_1.default.isEmpty(dependencies)) return (withStatements[table] = '')
            const withStatement = lodash_1.default
                .map(
                    dependencies,
                    (table) =>
                        `${table} AS (SELECT * FROM "${schema}"."${table}" ${partials[table]})`,
                )
                .join(',\n')
            withStatements[table] = `WITH ${withStatement}`
        })
        return withStatements
    }
    parseConfigFile(filepath) {
        try {
            return (0, config_yaml_1.default)(filepath)
        } catch (e) {
            console.error(
                chalk_1.default.red(
                    `\nUnable to parse config file located at ${chalk_1.default.white(filepath)}`,
                ),
            )
            console.error(`\nTip: Make sure your YAML is 100% YAMLy`)
            process.exit()
        }
    }
    async parseDbParams(params) {
        if (lodash_1.default.isNil(params)) return ``
        if (typeof params === 'object') {
            lodash_1.default.forIn(params, (v, k, o) => {
                if ((0, helpers_1.isEnvironmentVariable)(String(v))) {
                    o[k] = process.env[String(v).slice(1)]
                }
            })
            return (0, helpers_1.encodeConnectionParameters)(params)
        } else if ((0, helpers_1.isPgUri)(params)) {
            return params
        }
        try {
            const paramsResult = await (0, helpers_1.exec)(params)
            if ((0, helpers_1.isPgUri)(paramsResult)) return paramsResult
            try {
                const objectParams = relaxed_json_1.default.parse(paramsResult)
                return (0, helpers_1.encodeConnectionParameters)(objectParams)
            } catch (e) {
                console.error(
                    chalk_1.default.red(
                        `\nUnable to derive a connection string from the provided command`,
                    ),
                )
                console.error(
                    chalk_1.default.red(
                        `\nThe provided command output: ${chalk_1.default.white(lodash_1.default.trim(paramsResult))}`,
                    ),
                )
                process.exit()
            }
        } catch (e) {
            console.error(chalk_1.default.red(`\n${e}\n`))
            process.exit()
        }
    }
    findConfigFile(filepath) {
        filepath = filepath || (0, findup_sync_1.default)(constants.CONFIG_FILENAME_GLOB)
        if (!filepath) {
            this.generateConfigFile()
            console.error(
                chalk_1.default.yellow(
                    `\nUnable to find config file. Creating a generic ${chalk_1.default.white(`.postgrab.yaml`)} file in the current directory\n`,
                ),
            )
            console.error(
                `\nAdd your connection details to '.postgrab.yaml' and then run ${chalk_1.default.green(`postgrab --init`)} ` +
                    `to begin the interactive configuration process\n`,
            )
            process.exit()
        }
        return filepath
    }
    generateConfigFile(silent = true) {
        const OUTPUT_PATH = path_1.default.join(process.cwd(), constants.CONFIG_FILENAME)
        const configTemplate = fs_1.default.readFileSync(CONFIG_TEMPLATE_PATH, `utf-8`)
        fs_1.default.writeFileSync(OUTPUT_PATH, configTemplate)
        !silent &&
            console.log(
                `\nSuccessfully created config file located at '${chalk_1.default.green(OUTPUT_PATH)}'\n`,
            )
    }
}
exports.App = App
