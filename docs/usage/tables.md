# Syncing tables

By default, running `postgrab` without any arguments will sync all tables in the schema (except for the [excluded](configuration/file.md#exclude) ones). You can optionally specify which tables you want to sync using the [-t flag](configuration/cli.md#tables).

Postgrab intelligently **merges** remote data with your existing local data unless you pass it the [--truncate flag](configuration/cli.md#truncate), in which case your local target tables will be truncated prior to syncing.

**Postgrab offers several features which make syncing with a remote database faster and easier.** :alarm_clock: :tada:

#### Parallelism

Postgrab parallelizes work across a configurable number of workers (defaults to your number of CPU cores).

#### Partials

Partials allow you to limit the amount of data that you're syncing by [specifying](configuration/file.md#partials) a `WHERE` and/or `LIMIT` clause for each table. Large tables become less of a burden and you end up only transferring the data that you need. Partials can also reference/inject other partials which gives you even more control over your data.

#### Groups

Groups are like presets for tables. Define [groups](configuration/file.md#groups) within your config file and then pass the group name(s) to postgrab via the [-g flag](configuration/cli.md#groups). Tables can have a separate partial for each group that they're in.

#### Exclude

Most people don't need (or want) **all** their remote tables. List the tables you want to [exclude](configuration/file.md#exclude) in your `.postgrab.yaml` or pass them to postgrab via the [-e flag](configuration/cli.md#exclude)
