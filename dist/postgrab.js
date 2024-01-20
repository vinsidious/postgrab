'use strict'
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
const lodash_1 = __importDefault(require('lodash'))
const chalk_1 = __importDefault(require('chalk'))
const actions_1 = require('./actions')
class Postgrab extends actions_1.PostgrabBaseClass {
    async run() {
        const start = new Date()
        let actionInstance
        if (this.config.init) {
            actionInstance = new actions_1.InteractiveConfig(this.config)
        } else if (this.config.schemaOnly) {
            actionInstance = new actions_1.SyncSchema(this.config)
        } else {
            actionInstance = new actions_1.SyncTables(this.config)
        }
        await actionInstance.init().then(() => actionInstance.run())
        const totalTime = +new Date() - +start
        console.log(
            `• Total time: ${chalk_1.default.yellow(`${lodash_1.default.round(totalTime / 1000, 2)}s`)}`,
        )
    }
}
exports.default = Postgrab
