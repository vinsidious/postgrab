# Syncing schema

Before any data can be synced, your local schema for your target tables must match your remote schema. To sync all tables, just run:

```bash
postgrab --schema-only
```

Keep in mind that postgrab will currently `DROP` all local target tables prior to syncing schema. If you run `--schema-only` without any other args, postgrab will drop your local database, recreate it, and then sync your **entire** schema.

You can also use the [-t flag](configuration/cli.md#tables) to only sync the schema for specific tables:

```bash
postgrab -s -t table1,table2
```
