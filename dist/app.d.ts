import { ConnectionParameters, NormalObject, PostgrabConfig } from './interfaces'
import Postgrab from './postgrab'
export declare class App {
    args: any
    config: PostgrabConfig
    constructor()
    initialize(): Promise<Postgrab>
    mergeConfigFileWithUserArgs(configFile: any, userArgs: any): Promise<PostgrabConfig>
    removeUndefinedValuesFromObject(obj: NormalObject): NormalObject
    convertPartialsIntoCTE(partials: NormalObject, schema: string): {}
    parseConfigFile(filepath: string): any
    parseDbParams(params: null | string | ConnectionParameters): Promise<string>
    findConfigFile(filepath?: string): any
    generateConfigFile(silent?: boolean): void
}
