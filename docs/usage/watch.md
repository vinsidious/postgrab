# Watching tables

Ever wish you could continuously stream data from a remote source? **Now you can!** :umbrella:

**When you're watching a group of tables, postgrab will continuously check for new rows and fetch them at a [fixed interval](configuration/file.md#watch).**

#### Requirements

In order for this to work, you must provide either an **expression** or a **column** that has a [Postgres date/time data type](https://www.postgresql.org/docs/9.6/static/datatype-datetime.html). Postgrab will then copy rows from the remote tables where the specified column/expression is `>` the local `MAX()` of that column/expression.

If there isn't a local `MAX()` for the specified column (i.e. an empty table), postgrab will select the top `1000` rows from the remote database (ordered by the specified column descending). For each watched table, postgrab **always** limits each fetch to the first `1000` rows.

#### Avoiding unique violations

Just because a remote row is *newer* doesn't mean that it's actually **new** (e.g. using an `updated_at` column vs. a `created_at` column). Postgrab avoids violating single/multi-column uniqueness constraints by storing metadata for each target table which includes all their unique constraints/indices.

When watching tables, postgrab copies remote rows into a local temporary table and uses the table's metadata to compose a `DELETE FROM ... WHERE` clause which deletes all conflicting rows from the target table before inserting the rows from the temporary table. This operation is very fast since the `WHERE` clause is formed entirely from the table's unique constraints which are [automatically indexed](https://www.postgresql.org/docs/current/static/indexes-unique.html).
