# CLI options

Most CLI args either augment, reference, or override what's already defined in your `.postgrab.yaml`.

**Tip:** *The CLI is designed to be dynamic so that users will find it both intuitive and expressive. For instance, you'd typically specify the tables that you want to dump like this:*

```bash
postgrab -t table1,table2
```

But this will also work:

```bash
postgrab table1,table2
```

Similarly, all the following will work as expected:

```bash
# Watch tables
postgrab --watch table1,table2

# Sync the schema for specific tables
postgrab --schema-only table1,table2

# Sync a table and specify a custom partial
postgrab table1 "WHERE foo = 'bar'"
```

### schema-only
> `-s, --schema-only`

Will only sync tables' schema, not their data. Target tables will be dropped before they're synced. Combine this option with `-t` to only sync the schema for certain tables.

```bash
postgrab --schema-only --tables table1,table2

# Shorthand
postgrab -s table1,table2
```

### tables
> `-t, --tables <tables>`

A list of tables to sync (comma-delimited). Will use any partial(s) defined for the table(s) within your `.postgrab.yaml`. This will sync tables even if they're listed under `exclude` within your config file.

```bash
postgrab --tables table1,table2,table3

# Shorthand
postgrab table1,table2,table3
```

### groups
> `-g, --groups <groups>`

A list of groups to sync (comma-delimited). These groups must **already be defined** within your `.postgrab.yaml`.

```bash
postgrab --groups group1,group2
```

### watch
> `-w, --watch`

You can elect to "watch" the target tables so that postgrab will poll them for new rows at a fixed interval (configurable via [watch_interval_seconds](configuration/file.md#watch-interval)).

```bash
postgrab --watch --tables table1,table2

# Shorthand
postgrab -w table1,table2
```

### init
> `-i, --init`

Initiates interactive configuration. Postgrab will step through each one of your tables and ask you to choose from a list of columns that are eligible to be "bookmark" columns.

A **bookmark** column is any column that has a date/time or integer data type. Bookmark columns help us determine which rows on the remote database are new by comparing them to the local `MAX()` for that column.

```bash
postgrab --init
```

### config
> `-c, --config <path>`

Explicitly provide the path to `.postgrab.yaml`. By default, postgrab will traverse upward until it finds your config file.

```bash
postgrab -c ../../.postgrab.yaml
```

### truncate
> `-T, --truncate`

Truncate local target tables before syncing. By default, postgrab will merge remote data with your existing data.

```bash
postgrab -T -t table1,table2

# Shorthand
postgrab -T table1,table2
```

### max-workers
> `-m, --max-workers <count>`

Limits the number of parallel workers used when syncing tables (defaults to number of cores).

*Will override what's in your `.postgrab.yaml`.*

```bash
postgrab -m 2
```

### setup
> `-p, --setup <command>`

Specify a custom command that postgrab will run before checking the local/remote connections and syncing data.

*Will override what's in your `.postgrab.yaml`.*

```bash
postgrab -p "echo foo"
```

### local
> `-l, --local <uri|command>`

Local database connection string or a command which returns a connection string or config object.

*Will override what's in your `.postgrab.yaml`.*

```bash
postgrab -l postgres://me:pass@localhost:5432/my_db
```

### remote
> `-r, --remote <uri|command>`

Remote database connection string or a command which returns a connection string or config object.

*Will override what's in your `.postgrab.yaml`.*

```bash
postgrab -r postgres://foo:bar@somewhere.com:5432/my_db
```

### exclude
> `-e, --exclude <tables>`

A list of tables to exclude (comma-delimited).

*Will override what's in your `.postgrab.yaml`.*

```bash
postgrab -e table3,table4,table5
```

### schema
> `-S, --schema <name>`

Specify the local/remote schema name.

*Will override what's in your `.postgrab.yaml`.*

```bash
postgrab -S not_public
```
