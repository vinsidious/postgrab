import PostgrabBaseClass from './base';
export default class Watch extends PostgrabBaseClass {
    private tableStatus;
    private initialRowCount;
    private lastBookmarkValue;
    run(): Promise<void>;
    getRowCount(table: string, lastBookmarkValue: any): Promise<number>;
    getNewRowsForTable(table: string): Promise<unknown>;
}
