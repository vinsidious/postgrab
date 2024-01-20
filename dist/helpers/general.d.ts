/// <reference types="node" />
/// <reference types="node" />
import stream from 'stream'
import { ConnectionParameters, NormalObject } from '../interfaces'
export { default as exec } from './exec'
export declare function objectOrderBy(
    obj: NormalObject,
    orderKeys: any[],
    orderDirections?: (boolean | 'asc' | 'desc')[],
): {}
export declare class Spinner {
    private count
    private frames
    spin: () => string
}
export declare function prefixColumnNamesInWhereClause(whereClause: string, prefix: string): string
export declare function extractColumnNamesFromSqlStatement(statement: string): string[]
export declare function bufferToStream(buffer: Buffer | string): stream.Readable
export declare function sleep(ms?: number): Promise<unknown>
export declare function isEnvironmentVariable(str: string): boolean
export declare function parseConnectionString(
    connString: string,
): import('pg-connection-string').ConnectionOptions
export declare function encodeConnectionParameters(connParams: ConnectionParameters): string
export declare function isPgUri(connString: string): boolean
export declare class YAML {
    private static options
    static toJSON(data: string): NormalObject
    static fromJSON(data: NormalObject): string
    static require(filepath: string): NormalObject
    static save(filepath: any, data: string | NormalObject): void
}
