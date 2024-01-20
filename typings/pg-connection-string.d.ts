declare namespace PgConnectionString {
    export interface ConnectionParameters {
        user: string
        database: string
        host?: string
        port?: number
        password?: string
    }

    export function parse(connectionString: string): PgConnectionString.ConnectionParameters
}

declare module 'pg-connection-string' {
    export = PgConnectionString
}
