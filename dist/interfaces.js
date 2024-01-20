"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelForInteractiveConfigDefaultOption = exports.InteractiveConfigDefaultOption = exports.PreferredColumnName = exports.BookmarkableDataType = exports.DatabaseSource = void 0;
const chalk_1 = __importDefault(require("chalk"));
var DatabaseSource;
(function (DatabaseSource) {
    DatabaseSource[DatabaseSource["LOCAL"] = `local`] = "LOCAL";
    DatabaseSource[DatabaseSource["REMOTE"] = `remote`] = "REMOTE";
})(DatabaseSource || (exports.DatabaseSource = DatabaseSource = {}));
var BookmarkableDataType;
(function (BookmarkableDataType) {
    BookmarkableDataType["DATE"] = "date";
    BookmarkableDataType["INTEGER"] = "integer";
    BookmarkableDataType["TIMESTAMP_WITH_TIME_ZONE"] = "timestamp with time zone";
    BookmarkableDataType["TIMESTAMP_WITHOUT_TIME_ZONE"] = "timestamp without time zone";
})(BookmarkableDataType || (exports.BookmarkableDataType = BookmarkableDataType = {}));
var PreferredColumnName;
(function (PreferredColumnName) {
    PreferredColumnName["UPDATED_AT"] = "updated_at";
    PreferredColumnName["CREATED_AT"] = "created_at";
})(PreferredColumnName || (exports.PreferredColumnName = PreferredColumnName = {}));
var InteractiveConfigDefaultOption;
(function (InteractiveConfigDefaultOption) {
    InteractiveConfigDefaultOption["NO_COLUMN"] = "NO_COLUMN";
    InteractiveConfigDefaultOption["EXCLUDE"] = "EXCLUDE";
})(InteractiveConfigDefaultOption || (exports.InteractiveConfigDefaultOption = InteractiveConfigDefaultOption = {}));
exports.LabelForInteractiveConfigDefaultOption = {
    [InteractiveConfigDefaultOption.EXCLUDE]: `Exclude`,
    [InteractiveConfigDefaultOption.NO_COLUMN]: `No column ${chalk_1.default.dim(`(dump entire table if local/remote row counts aren't equal)`)}`,
};
