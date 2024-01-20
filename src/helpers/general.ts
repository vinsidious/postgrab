import chalk from 'chalk'
import fs from 'fs'
import yaml from 'js-yaml'
import _ from 'lodash'
import { parse } from 'pg-connection-string'
import pgQueryParser from 'pg-query-parser'
import stream from 'stream'

import * as defaults from '../defaults'
import { ConnectionParameters, NormalObject } from '../interfaces'

export { default as exec } from './exec'

/**
 * General helpers
 */

// Mostly a vanity helper since key/value order in objects isn't guaranteed in
// JS. Helps keep things in order when writing an object to a YAML file, though.
// Expects an object where each value is also an object.
export function objectOrderBy(
    obj: NormalObject,
    orderKeys: any[],
    orderDirections?: (boolean | 'asc' | 'desc')[],
) {
    const swapArr = []
    _.forIn(obj, (v, k) => swapArr.push({ __KEY__: k, ...v }))
    const orderedSwapArr = _.orderBy(swapArr, orderKeys, orderDirections)
    const orderedObj = {}
    _.forEach(orderedSwapArr, ({ __KEY__, ...value }: any) => (orderedObj[__KEY__] = value))
    return orderedObj
}

export class Spinner {
    private count = 0
    private frames = [`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`]
    spin = () => chalk.dim(this.frames[(this.count = ++this.count % this.frames.length)])
}

export function prefixColumnNamesInWhereClause(whereClause: string, prefix: string): string {
    const SELECT_FROM_CLAUSE = `SELECT * FROM _ WHERE `
    const { query } = pgQueryParser.parse(SELECT_FROM_CLAUSE + whereClause)
    const where = _.get(pgQueryParser.byType(query, `whereClause`), `0.whereClause`, [])
    _.forEach(pgQueryParser.byType(where, `fields`), ({ fields }) =>
        fields.unshift({ String: { str: prefix } }),
    )
    return pgQueryParser.deparse(query).replace(/SELECT \* FROM .* WHERE /i, ``)
}

export function extractColumnNamesFromSqlStatement(statement: string): string[] {
    const { query } = pgQueryParser.parse(statement)
    const { indexParams } = _.get(pgQueryParser.byType(query, `indexParams`), `0`, {}) as any
    const columnRefs = pgQueryParser.byType(indexParams, `ColumnRef`)
    const columnRefCols = _.map(columnRefs, ({ ColumnRef: { fields } }) => {
        return _.map(fields, `String.str`).join(`.`)
    })
    const names = pgQueryParser.byType(indexParams, `name`)
    const nameCols = _.map(names, `name`) as string[]
    return _.compact([...nameCols, ...columnRefCols])
}

export function bufferToStream(buffer: Buffer | string): stream.Readable {
    if (typeof buffer !== 'object') buffer = new Buffer(buffer)
    const _stream = new stream.Duplex()
    _stream.push(buffer)
    _stream.push(null)
    return _stream
}

export async function sleep(ms: number = 1000) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isEnvironmentVariable(str: string): boolean {
    return /^\$[a-zA-Z_$]*$/.test(str)
}

/**
 * Connection parameters/URI helpers
 */

export function parseConnectionString(connString: string) {
    const params = parse(connString)
    params.port = ~~params.port
    params.user = params.user || process.env.USER
    return params
}

export function encodeConnectionParameters(connParams: ConnectionParameters): string {
    if (typeof connParams !== 'object') {
        throw new Error(`You must provide your connection parameters in the form of an object`)
    }
    // https://github.com/Microsoft/TypeScript/issues/12532
    connParams = { ...defaults.CONNECTION_PARAMETERS, ...connParams }
    const { user, password, database, host, port } = connParams
    return `postgres://${user}${password ? `:${password}` : ``}@${host}:${port}/${database}`
}

export function isPgUri(connString: string): boolean {
    return /^postgres:\/{2}/.test(connString)
}

/**
 * YAMLy helpers
 */

export class YAML {
    private static options = {
        indent: 2,
        styles: { '!!null': 'canonical' },
    }

    static toJSON(data: string): NormalObject {
        return yaml.load(data)
    }

    static fromJSON(data: NormalObject): string {
        return yaml.dump(data, this.options)
    }

    static require(filepath: string): NormalObject {
        return this.toJSON(fs.readFileSync(filepath, `utf8`))
    }

    static save(filepath, data: string | NormalObject): void {
        if (isObject(data)) {
            data = this.fromJSON(data)
        }
        fs.writeFileSync(filepath, data)
    }
}

function isObject(arg: string | NormalObject): arg is NormalObject {
    return typeof arg !== `string`
}
