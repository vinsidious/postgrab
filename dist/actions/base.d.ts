/// <reference types="node" />
/// <reference types="node" />
import { ChildProcess } from 'child_process'
import Ora from 'ora'
import stream from 'stream'
import { DatabaseSource, LocalAndRemotePool, PostgrabConfig, TableMetadata } from '../interfaces'
export default abstract class PostgrabBaseClass {
    config: PostgrabConfig
    tables: {
        [tableName: string]: TableMetadata
    }
    remoteTableNames: string[]
    tableRowCount: {
        [table: string]: number
    }
    pool: LocalAndRemotePool
    draft: any
    status: Ora
    constructor(config: PostgrabConfig)
    abstract run(): Promise<any>
    init(): Promise<void>
    createPool(source: DatabaseSource): void
    abstractQuery(
        source: DatabaseSource,
        queryable: string | stream.Readable,
    ): Promise<any[]> | stream.Readable
    get query(): {
        local: any
        remote: any
    }
    checkForTablesLocally(): Promise<void>
    getRemoteMetadataForTargetTables(): Promise<void>
    getTableNames(source: DatabaseSource): Promise<string[] | void>
    streamingCopy(remoteCmd: string, localCmd: string): any
    streamingMergeCopy(tableData: TableMetadata, remoteCmd?: string): Promise<ChildProcess>
    testConnections(): Promise<void>
    getLocalMaxForTable(table: string): Promise<any>
    getRemoteWhereClauseForTable(table: string): Promise<string>
    runSetup(): Promise<void>
}
