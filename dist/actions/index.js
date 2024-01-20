'use strict'
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              var desc = Object.getOwnPropertyDescriptor(m, k)
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k]
                      },
                  }
              }
              Object.defineProperty(o, k2, desc)
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k
              o[k2] = m[k]
          })
var __exportStar =
    (this && this.__exportStar) ||
    function (m, exports) {
        for (var p in m)
            if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
                __createBinding(exports, m, p)
    }
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.SyncTables =
    exports.SyncSchema =
    exports.InteractiveConfig =
    exports.PostgrabBaseClass =
        void 0
var base_1 = require('./base')
Object.defineProperty(exports, 'PostgrabBaseClass', {
    enumerable: true,
    get: function () {
        return __importDefault(base_1).default
    },
})
var interactive_config_1 = require('./interactive_config')
Object.defineProperty(exports, 'InteractiveConfig', {
    enumerable: true,
    get: function () {
        return __importDefault(interactive_config_1).default
    },
})
var sync_schema_1 = require('./sync_schema')
Object.defineProperty(exports, 'SyncSchema', {
    enumerable: true,
    get: function () {
        return __importDefault(sync_schema_1).default
    },
})
__exportStar(require('./sync_tables'), exports)
var sync_tables_1 = require('./sync_tables')
Object.defineProperty(exports, 'SyncTables', {
    enumerable: true,
    get: function () {
        return __importDefault(sync_tables_1).default
    },
})
