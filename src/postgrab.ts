import _ from 'lodash'
import chalk from 'chalk'

import { InteractiveConfig, PostgrabBaseClass, SyncSchema, SyncTables } from './actions'

export default class Postgrab extends PostgrabBaseClass {
    async run() {
        const start = new Date()

        let actionInstance
        if (this.config.init) {
            actionInstance = new InteractiveConfig(this.config)
        } else if (this.config.schemaOnly) {
            actionInstance = new SyncSchema(this.config)
        } else {
            actionInstance = new SyncTables(this.config)
        }

        await actionInstance.init().then(() => actionInstance.run())
        const totalTime = +new Date() - +start
        console.log(`• Total time: ${chalk.yellow(`${_.round(totalTime / 1000, 2)}s`)}`)
    }
}
