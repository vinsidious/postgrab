'use strict'
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
const chalk_1 = __importDefault(require('chalk'))
const inquirer_1 = __importDefault(require('inquirer'))
const lodash_1 = __importDefault(require('lodash'))
const helpers_1 = require('../helpers')
const interfaces_1 = require('../interfaces')
const base_1 = __importDefault(require('./base'))
const DEFAULT_CHOICES = [
    new inquirer_1.default.Separator(),
    interfaces_1.LabelForInteractiveConfigDefaultOption.NO_COLUMN,
    interfaces_1.LabelForInteractiveConfigDefaultOption.EXCLUDE,
]
class InteractiveConfig extends base_1.default {
    async run() {
        if (!this.config.configFile.tables) {
            const questions = this.generateQuestionsFromTables()
            this.answers = await inquirer_1.default.prompt(questions)
            this.persistChoices()
        } else {
            console.log(
                chalk_1.default.blue(
                    `\nIt looks like you've already completed interactive configuration!`,
                ),
            )
            console.log(
                `\nIf you need to make any further changes to your '.postgrab.yaml', ` +
                    `it's much easier to simply edit the file directly.\n`,
            )
            process.exit()
        }
    }
    generateQuestionsFromTables() {
        return lodash_1.default.map(
            lodash_1.default.sortBy(lodash_1.default.keys(this.tables)),
            (tableName) => {
                const bookmarkableColumns = lodash_1.default.filter(
                    this.tables[tableName].columns,
                    (column) => {
                        return lodash_1.default.includes(
                            lodash_1.default.values(interfaces_1.BookmarkableDataType),
                            column.type,
                        )
                    },
                )
                return {
                    name: tableName,
                    type: `list`,
                    message: `Choose a bookmark column for ${chalk_1.default.green(tableName)}`,
                    choices: lodash_1.default
                        .orderBy(bookmarkableColumns, ({ name, type }) => {
                            if (name === interfaces_1.PreferredColumnName.UPDATED_AT) {
                                return 0
                            } else if (name === interfaces_1.PreferredColumnName.CREATED_AT) {
                                return 1
                            } else {
                                switch (type) {
                                    case interfaces_1.BookmarkableDataType.TIMESTAMP_WITH_TIME_ZONE:
                                        return 2
                                    case interfaces_1.BookmarkableDataType
                                        .TIMESTAMP_WITHOUT_TIME_ZONE:
                                        return 2
                                    case interfaces_1.BookmarkableDataType.DATE:
                                        return 2
                                    case interfaces_1.BookmarkableDataType.INTEGER:
                                        return 3
                                }
                            }
                        })
                        .concat(...DEFAULT_CHOICES),
                }
            },
        )
    }
    persistChoices() {
        const { configFile } = this.config
        const configTables = lodash_1.default.mapValues(this.answers, (bookmark) => {
            const config = {}
            if (bookmark === interfaces_1.LabelForInteractiveConfigDefaultOption.EXCLUDE)
                config.dump = false
            else if (bookmark !== interfaces_1.LabelForInteractiveConfigDefaultOption.NO_COLUMN)
                config.bookmark = bookmark
            return config
        })
        configFile[`tables`] = (0, helpers_1.objectOrderBy)(
            configTables,
            [`dump`, (val) => !!val.bookmark],
            [`desc`, `desc`],
        )
        helpers_1.YAML.save(this.config.configFilepath, configFile)
        console.log(
            `\nYour choices have been saved to your ${chalk_1.default.green(`.postgrab.yaml`)} file.\n`,
        )
    }
}
exports.default = InteractiveConfig
