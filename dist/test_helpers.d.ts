export default class Generate {
    static configFile(): {
        local: string
        remote: {
            user: string
            password: string
            database: string
            host: string
        }
        tables: {
            table_1: {
                bookmark: string
                partial: string
                dump: boolean
            }
            table_2: {
                bookmark: string
                partial: string
                dump: boolean
            }
            table_3: {
                bookmark: string
                partial: string
                dump: boolean
            }
        }
        groups: {
            group_1: string[]
        }
    }
    static userArgs(): {
        groups: any[]
        exclude: any[]
        partials: any
    }
}
