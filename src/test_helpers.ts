export default class Generate {
    static configFile() {
        return {
            local: 'postgres://localhost:5432/test_db',
            remote: {
                user: 'postgres',
                password: 'sewSekyure123',
                database: 'test_db',
                host: 'localhost',
            },
            tables: {
                table_1: {
                    bookmark: 'updated_at',
                    partial: "WHERE foo_bar = 'baz'",
                    dump: true,
                },
                table_2: {
                    bookmark: 'updated_at',
                    partial: 'WHERE id IN (SELECT id FROM {{ table_1 }})',
                    dump: true,
                },
                table_3: {
                    bookmark: 'created_at',
                    partial: 'WHERE id IN (SELECT id FROM {{ table_2 }})',
                    dump: true,
                },
            },
            groups: {
                group_1: ['table_1', 'table_2'],
            },
        }
    }

    static userArgs() {
        return {
            groups: [],
            exclude: [],
            partials: null,
        }
    }
}
