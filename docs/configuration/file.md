# Config file

Having a strong `.postgrab.yaml` is key to experiencing the full power of postgrab. Fortunately, postgrab makes this relatively painless by walking you through an [**interactive configuration**](configuration/file.md#interactive-configuration) process.

#### Generating a config file

You can initialize a basic config file in your current directory by simply running:

```
postgrab
```

Open the newly created file and fill in your local/remote database connection parameters. Once you've done that, you can proceed to interactive configuration.

#### Local/remote connections

At a bare minimum, you must specify your **local** and **remote** connection parameters. Postgrab tries to be flexible (and secure) by allowing you to specify your connection parameters as either a **connection string/URI**, an **object**, **environment variables**, or as a **command** that returns a connection string or object.

This means that any of the following will work:

```yaml
remote: postgres://me:password123@somewhere.someplace.com:5432/my_db

remote: $REMOTE_DB_CONNECTION_STRING

remote: ./scripts/get_local_conn_string.sh

remote:
  user: user_name
  host: $PGHOST
  database: $PGDATABASE
  password: $PGPASSWORD
```

You're also able to specify a custom **schema**. Postgrab will default to using the `public` schema if you don't set one explicitly. Note that currently your local/remote schema names must be the same.

```yaml
schema: 'foo_bar'
```

#### Interactive configuration

The purpose of postgrab's interactive configuration process is to remove some of the pain of getting set up for the first time while also making everything less prone to error. While none of the data collected during interactive configuration is strictly required in order for postgrab to operate, it allows you to access the full spectrum of features/functionalities that postgrab has to offer.

**Note:** *If you choose to skip interactive configuration, you'll only ever be able to dump tables in their **entirety**.*

Once you have a `.postgrab.yaml` file created and you've entered your local/remote connection parameters, start interactive configuration by running:

```bash
postgrab --init
```

Postgrab will run some queries against your remote database which return metadata for each table including the data type of each of its columns. The primary goal of interactive configuration is to define a **bookmark column** for each of your tables. A bookmark column is any column that has a **date/time** or **integer** data type that can be used to determine which remote rows are **new** by comparing them with the local `MAX()` for that table/column.

For each table, you'll see options like the following:

```
? Choose a bookmark column for <table> (Use arrow keys)
❯ updated_at
  created_at
  rank
  ──────────────
  No column (dump entire table if local/remote row counts aren't equal)
  Exclude

```

Postgrab lists all eligible columns for each table along with a couple of default options:

* **No column**
  - Sometimes you either won't have an eligible column or you'll have a use case that doesn't require incremental replication. In those situations, choose this option to only compare your local/remote row counts—if they match, postgrab won't dump any rows for that table. If they differ, postgrab will re-dump the **entire table**. If you manually edit your `.postgrab.yaml` at a later time and specify a partial for that table, postgrab **will** use that partial when gathering/comparing your local and remote row counts.
* **Exclude**
  - Most people have at least a *few* tables that they're not interested in dumping. Choose this option to automatically ignore a table each time you run `postgrab`.
  - **Note:** *You can still dump an excluded table by explicitly passing the table name as a CLI arg.*

Once you've finished making your choices for all your tables, postgrab will add the data to your existing `.postgrab.yaml`. If you open the file manually, you should see something similar to the following:

```yaml
tables:
  table1:
    bookmark: updated_at
    partial: ~
    dump: true
  table2:
    bookmark: ~
    partial: ~
    dump: false
```

As you can see, postgrab automatically sets up the overall structure for you and fills in the `bookmark` and `dump` values based on your earlier answers. All that's left to do is to specify some partials! (optional but recommended)

#### Partials

While it's perfectly fine to sync your full tables, one of the best parts of postgrab is the ability to specify **partials** within your config file. Partials allow you to add a `WHERE` clause per table so that you're only syncing the data that you actually need.

Partials can also **cross-reference** other partials. Since most databases are, well, *relational*—it's likely that the data you're syncing from one table will have foreign key relations with one or more other tables. The syntax for referencing other partials looks like `{{ other_table }}`. Here's an example:

```yaml
tables:
  table1:
    bookmark: updated_at
    partial: "WHERE foo = 'bar'"
    dump: true
  table2:
    bookmark: ~
    partial: "WHERE id IN (SELECT id FROM {{ table1 }})"
    dump: true
```

#### Exclude

Any tables that you've explicitly chosen to exclude during interactive configuration will be excluded from regular dumps. You can still dump these tables by passing their name(s) to `postgrab` at runtime. If you decide at a later time that you'd like to begin dumping these tables, you can change `dump: false` to `dump: true` for that table within your `.postgrab.yaml`.

```yaml
tables:
  table3:
    bookmark: ~
    partial: ~
    dump: false
```

#### Groups

Postgrab lets you define custom groups of tables to dump so that you only have to specify the group name(s) when running `postgrab`. Simply add something similar to the following inside of your `.postgrab.yaml`.

```yaml
groups:
  group1:
    - table1
    - table2
```

#### Watch Interval Seconds

When using postgrab's watch mode, you're able to control the update frequency by setting `watch_interval_seconds` (defaults to `20`).

```yaml
watch_interval_seconds: 10
```

#### Parallelism

You're able to control the max number of parallel workers used when syncing tables by setting `max_workers`. If you don't specify a value (or set it to `0`), it will default to your machine's number of CPU cores.

```yaml
max_workers: 2
```
