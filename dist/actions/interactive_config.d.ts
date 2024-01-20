import PostgrabBaseClass from './base';
export default class InteractiveConfig extends PostgrabBaseClass {
    private answers;
    run(): Promise<void>;
    private generateQuestionsFromTables;
    private persistChoices;
}
