"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YAML = exports.isPgUri = exports.encodeConnectionParameters = exports.parseConnectionString = exports.isEnvironmentVariable = exports.sleep = exports.bufferToStream = exports.extractColumnNamesFromSqlStatement = exports.prefixColumnNamesInWhereClause = exports.Spinner = exports.objectOrderBy = exports.exec = void 0;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = __importDefault(require("fs"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const lodash_1 = __importDefault(require("lodash"));
const pg_connection_string_1 = require("pg-connection-string");
const pg_query_parser_1 = __importDefault(require("pg-query-parser"));
const stream_1 = __importDefault(require("stream"));
const defaults = __importStar(require("../defaults"));
var exec_1 = require("./exec");
Object.defineProperty(exports, "exec", { enumerable: true, get: function () { return __importDefault(exec_1).default; } });
function objectOrderBy(obj, orderKeys, orderDirections) {
    const swapArr = [];
    lodash_1.default.forIn(obj, (v, k) => swapArr.push({ __KEY__: k, ...v }));
    const orderedSwapArr = lodash_1.default.orderBy(swapArr, orderKeys, orderDirections);
    const orderedObj = {};
    lodash_1.default.forEach(orderedSwapArr, ({ __KEY__, ...value }) => (orderedObj[__KEY__] = value));
    return orderedObj;
}
exports.objectOrderBy = objectOrderBy;
class Spinner {
    constructor() {
        this.count = 0;
        this.frames = [`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`];
        this.spin = () => chalk_1.default.dim(this.frames[(this.count = ++this.count % this.frames.length)]);
    }
}
exports.Spinner = Spinner;
function prefixColumnNamesInWhereClause(whereClause, prefix) {
    const SELECT_FROM_CLAUSE = `SELECT * FROM _ WHERE `;
    const { query } = pg_query_parser_1.default.parse(SELECT_FROM_CLAUSE + whereClause);
    const where = lodash_1.default.get(pg_query_parser_1.default.byType(query, `whereClause`), `0.whereClause`, []);
    lodash_1.default.forEach(pg_query_parser_1.default.byType(where, `fields`), ({ fields }) => fields.unshift({ String: { str: prefix } }));
    return pg_query_parser_1.default.deparse(query).replace(/SELECT \* FROM .* WHERE /i, ``);
}
exports.prefixColumnNamesInWhereClause = prefixColumnNamesInWhereClause;
function extractColumnNamesFromSqlStatement(statement) {
    const { query } = pg_query_parser_1.default.parse(statement);
    const { indexParams } = lodash_1.default.get(pg_query_parser_1.default.byType(query, `indexParams`), `0`, {});
    const columnRefs = pg_query_parser_1.default.byType(indexParams, `ColumnRef`);
    const columnRefCols = lodash_1.default.map(columnRefs, ({ ColumnRef: { fields } }) => {
        return lodash_1.default.map(fields, `String.str`).join(`.`);
    });
    const names = pg_query_parser_1.default.byType(indexParams, `name`);
    const nameCols = lodash_1.default.map(names, `name`);
    return lodash_1.default.compact([...nameCols, ...columnRefCols]);
}
exports.extractColumnNamesFromSqlStatement = extractColumnNamesFromSqlStatement;
function bufferToStream(buffer) {
    if (typeof buffer !== 'object')
        buffer = new Buffer(buffer);
    const _stream = new stream_1.default.Duplex();
    _stream.push(buffer);
    _stream.push(null);
    return _stream;
}
exports.bufferToStream = bufferToStream;
async function sleep(ms = 1000) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
function isEnvironmentVariable(str) {
    return /^\$[a-zA-Z_$]*$/.test(str);
}
exports.isEnvironmentVariable = isEnvironmentVariable;
function parseConnectionString(connString) {
    const params = (0, pg_connection_string_1.parse)(connString);
    params.port = ~~params.port;
    params.user = params.user || process.env.USER;
    return params;
}
exports.parseConnectionString = parseConnectionString;
function encodeConnectionParameters(connParams) {
    if (typeof connParams !== 'object') {
        throw new Error(`You must provide your connection parameters in the form of an object`);
    }
    connParams = { ...defaults.CONNECTION_PARAMETERS, ...connParams };
    const { user, password, database, host, port } = connParams;
    return `postgres://${user}${password ? `:${password}` : ``}@${host}:${port}/${database}`;
}
exports.encodeConnectionParameters = encodeConnectionParameters;
function isPgUri(connString) {
    return /^postgres:\/{2}/.test(connString);
}
exports.isPgUri = isPgUri;
class YAML {
    static toJSON(data) {
        return js_yaml_1.default.load(data);
    }
    static fromJSON(data) {
        return js_yaml_1.default.dump(data, this.options);
    }
    static require(filepath) {
        return this.toJSON(fs_1.default.readFileSync(filepath, `utf8`));
    }
    static save(filepath, data) {
        if (isObject(data)) {
            data = this.fromJSON(data);
        }
        fs_1.default.writeFileSync(filepath, data);
    }
}
exports.YAML = YAML;
YAML.options = {
    indent: 2,
    styles: { '!!null': 'canonical' },
};
function isObject(arg) {
    return typeof arg !== `string`;
}
