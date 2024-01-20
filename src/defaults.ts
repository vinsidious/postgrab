export const CONNECTION_PARAMETERS = {
    user: process.env.USER,
    database: process.env.USER,
    host: `localhost`,
    port: 5432,
}

export const SCHEMA_NAME = `public`
export const MAX_WORKERS = require('os').cpus().length
