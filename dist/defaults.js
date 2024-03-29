'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.MAX_WORKERS = exports.SCHEMA_NAME = exports.CONNECTION_PARAMETERS = void 0
exports.CONNECTION_PARAMETERS = {
    user: process.env.USER,
    database: process.env.USER,
    host: `localhost`,
    port: 5432,
}
exports.SCHEMA_NAME = `public`
exports.MAX_WORKERS = require('os').cpus().length
