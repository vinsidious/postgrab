import PostgrabBaseClass from './base';
export default class SyncSchema extends PostgrabBaseClass {
    run(): Promise<void>;
    private dropNecessaryTables;
    private errorAndExit;
    private terminateOpenConnections;
    private findMissingExtensions;
}
