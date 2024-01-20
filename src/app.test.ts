import _ from 'lodash'

import { App } from './app'
import Generate from './test_helpers'

describe(`App`, () => {
    let app: App, configFile, userArgs

    beforeEach(() => {
        app = App.prototype
        configFile = Generate.configFile()
        userArgs = Generate.userArgs()
    })

    describe(`mergeConfigFileWithUserArgs`, () => {
        async function mergeConfigFileWithUserArgs() {
            return await app.mergeConfigFileWithUserArgs(configFile, userArgs)
        }

        it(`creates a connection URI from the passed-in config file's params`, async () => {
            const mergedConfig = await mergeConfigFileWithUserArgs()
            const { user, password, host, database } = configFile.remote
            expect(mergedConfig.remote).toBe(
                `postgres://${user}:${password}@${host}:5432/${database}`,
            )
        })

        it(`gives preference when tables are specified via CLI args`, async () => {
            userArgs.tables = [`table_1`]
            const mergedConfig = await mergeConfigFileWithUserArgs()
            expect(mergedConfig.tables).toMatchObject(userArgs.tables)
        })

        it(`gives preference when excluded tables are specified via CLI args`, async () => {
            userArgs.exclude = [`table_1`, `table_2`]
            const mergedConfig = await mergeConfigFileWithUserArgs()
            expect(mergedConfig.exclude).toMatchObject(userArgs.exclude)
        })

        it(`extracts bookmarks correctly`, async () => {
            const bookmark = `foo_bar_baz`
            _.forIn(configFile.tables, (tableData) => _.assign(tableData, { bookmark }))
            const mergedConfig = await mergeConfigFileWithUserArgs()
            expect(_.uniq(_.values(mergedConfig.bookmarks))).toMatchObject([bookmark])
        })

        it(`extracts partials correctly`, async () => {
            const partial = `WHERE buz_quux = 'foo-bar'`
            _.forIn(configFile.tables, (tableData) => _.assign(tableData, { partial }))
            const mergedConfig = await mergeConfigFileWithUserArgs()
            expect(_.uniq(_.values(mergedConfig.partials))).toMatchObject([partial])
        })
    })

    describe(`convertPartialsIntoCTE`, () => {
        it(`creates 'WITH' statements for all tables that depend on the partials of other tables`, () => {
            const tableOnePartial = `WHERE foo_bar = 'baz'`
            const tableTwoPartial = 'WHERE id IN (SELECT id FROM {{ table1 }})'
            const partials = { table1: tableOnePartial, table2: tableTwoPartial }
            const withStatements = app.convertPartialsIntoCTE(partials, 'public')
            expect(withStatements).toMatchSnapshot()
        })
    })
})
