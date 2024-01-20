import chalk from 'chalk'
import inquirer from 'inquirer'
import _ from 'lodash'

import { objectOrderBy, YAML } from '../helpers'
import {
    BookmarkableDataType,
    LabelForInteractiveConfigDefaultOption,
    PreferredColumnName,
} from '../interfaces'
import PostgrabBaseClass from './base'

const DEFAULT_CHOICES = [
    new inquirer.Separator(),
    LabelForInteractiveConfigDefaultOption.NO_COLUMN,
    LabelForInteractiveConfigDefaultOption.EXCLUDE,
]

export default class InteractiveConfig extends PostgrabBaseClass {
    private answers: { [tableName: string]: string }

    async run() {
        if (!this.config.configFile.tables) {
            const questions = this.generateQuestionsFromTables()
            this.answers = await inquirer.prompt(questions)
            this.persistChoices()
        } else {
            console.log(
                chalk.blue(`\nIt looks like you've already completed interactive configuration!`),
            )
            console.log(
                `\nIf you need to make any further changes to your '.postgrab.yaml', ` +
                    `it's much easier to simply edit the file directly.\n`,
            )
            process.exit()
        }
    }

    private generateQuestionsFromTables(): {} {
        return _.map(_.sortBy(_.keys(this.tables)), (tableName) => {
            const bookmarkableColumns = _.filter(this.tables[tableName].columns, (column) => {
                return _.includes(_.values(BookmarkableDataType), column.type)
            })
            return {
                name: tableName,
                type: `list`,
                message: `Choose a bookmark column for ${chalk.green(tableName)}`,
                choices: _.orderBy(bookmarkableColumns, ({ name, type }) => {
                    // Return an integer to help us sort the available columns so that
                    // anything named `updated_at` is our number one pick, followed by
                    // anything named `created_at`, followed by any timestamp column, and
                    // finally followed by any integer column
                    if (name === PreferredColumnName.UPDATED_AT) {
                        return 0
                    } else if (name === PreferredColumnName.CREATED_AT) {
                        return 1
                    } else {
                        switch (type) {
                            case BookmarkableDataType.TIMESTAMP_WITH_TIME_ZONE:
                                return 2
                            case BookmarkableDataType.TIMESTAMP_WITHOUT_TIME_ZONE:
                                return 2
                            case BookmarkableDataType.DATE:
                                return 2
                            case BookmarkableDataType.INTEGER:
                                return 3
                        }
                    }
                }).concat(...DEFAULT_CHOICES),
            }
        })
    }

    private persistChoices() {
        const { configFile } = this.config
        const configTables = _.mapValues(this.answers, (bookmark) => {
            const config: any = {}
            if (bookmark === LabelForInteractiveConfigDefaultOption.EXCLUDE) config.dump = false
            else if (bookmark !== LabelForInteractiveConfigDefaultOption.NO_COLUMN)
                config.bookmark = bookmark
            return config
        })
        configFile[`tables`] = objectOrderBy(
            configTables,
            [`dump`, (val) => !!val.bookmark],
            [`desc`, `desc`],
        )
        YAML.save(this.config.configFilepath, configFile)
        console.log(
            `\nYour choices have been saved to your ${chalk.green(`.postgrab.yaml`)} file.\n`,
        )
    }
}
