'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.JSON_COLUMN_ACCESSORS =
    exports.PARTIAL_REF_REGEX =
    exports.LOG_LINE_UPDATE_INTERVAL_MS =
    exports.CONFIG_TEMPLATE_PATH =
    exports.CONFIG_FILENAME_GLOB =
    exports.CONFIG_FILENAME =
        void 0
exports.CONFIG_FILENAME = `.postgrab.yaml`
exports.CONFIG_FILENAME_GLOB = `.postgrab.y*ml`
exports.CONFIG_TEMPLATE_PATH = `data/config.yaml`
exports.LOG_LINE_UPDATE_INTERVAL_MS = 70
exports.PARTIAL_REF_REGEX = /\{{2}\s?(\w+)\s?\}{2}/g
exports.JSON_COLUMN_ACCESSORS = ['->', '->>', '#>', '#>>', '@>', '<@']
