import chalk from 'chalk'
import Pg from 'pg'

export interface Exec {
    (cmd: any, options?: ExecOptions): Promise<string>
    sync(cmd: string): string
}

export interface ExecOptions {
    stream?: NodeJS.ReadWriteStream
    input?: NodeJS.ReadableStream
    quiet?: boolean
    dontSplit?: boolean
    pipeOnly?: boolean
}

export interface ConnectionParameters {
    user?: string
    password?: string
    database?: string
    host?: string
    port?: number
}

export interface PostgrabConfig {
    local: string
    metrics: boolean
    remote: string
    schema?: string
    schemaOnly?: boolean
    maxWorkers?: number
    tables?: string[]
    exclude?: string[]
    setup?: string
    truncate?: boolean
    init?: boolean
    partials?: NormalObject
    bookmarks?: NormalObject
    configFile?: any
    configFilepath?: string
    withStatements?: NormalObject
}

export enum DatabaseSource {
    LOCAL = <any>`local`,
    REMOTE = <any>`remote`,
}

export interface ColumnMetadata {
    name: string
    type: string
    isPrimaryKey: boolean
    isGenerated: boolean
}

export interface UniqueIndexMetadata {
    name: string
    whereClause?: string
    columns: string[]
}

export interface TableMetadata {
    name: string
    primaryKey: string
    columns: ColumnMetadata[]
    uniqueIndices: UniqueIndexMetadata[]
}

export interface LocalAndRemotePool {
    local?: Pg.Pool
    remote?: Pg.Pool
}

export enum BookmarkableDataType {
    DATE = 'date',
    INTEGER = 'integer',
    TIMESTAMP_WITH_TIME_ZONE = 'timestamp with time zone',
    TIMESTAMP_WITHOUT_TIME_ZONE = 'timestamp without time zone',
}

export enum PreferredColumnName {
    UPDATED_AT = 'updated_at',
    CREATED_AT = 'created_at',
}

export enum InteractiveConfigDefaultOption {
    NO_COLUMN = 'NO_COLUMN',
    EXCLUDE = 'EXCLUDE',
}

export const LabelForInteractiveConfigDefaultOption = {
    [InteractiveConfigDefaultOption.EXCLUDE]: `Exclude`,
    [InteractiveConfigDefaultOption.NO_COLUMN]: `No column ${chalk.dim(
        `(dump entire table if local/remote row counts aren't equal)`,
    )}`,
}

export type NormalObject = { [key: string]: any }
