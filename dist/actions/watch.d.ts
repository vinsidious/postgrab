import PostgrabBaseClass from './base'
export default class Watch extends PostgrabBaseClass {
    private tableStatus
    run(): Promise<void>
    getNewRowsForTable(table: string): Promise<unknown>
}
