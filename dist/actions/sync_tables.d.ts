import { DatabaseSource } from '../interfaces';
import PostgrabBaseClass from './base';
export declare function worker(): Promise<void>;
export default class SyncTables extends PostgrabBaseClass {
    private workers;
    private workerCount;
    private whereClauses;
    private remoteRowCounts;
    run(): Promise<void>;
    private runMaster;
    private spawnWorkerForTable;
    getCountForTableAndSource(table: string, source: DatabaseSource): Promise<any>;
    localAndRemoteCountsMatch(table: string): Promise<boolean>;
    private printMetrics;
    syncTable(table: string): Promise<any>;
    private truncateLocalTargetTables;
}
