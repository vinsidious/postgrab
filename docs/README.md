# postgrab

> The **fast**, **fun**, and **easy** way to sync data between two databases 🚀✨

Postgrab is here to alleviate the burden of syncing your local and remote databases. What was once a slow, inflexible, and error-prone process is now fast, feature-filled, and fault-tolerant. With postgrab, you're able to sync **just** the data you need by defining [partials](configuration/file.md#partials) for your tables. The best part about partials is that they are able to inject/reference other partials! This lets you pull just a fraction of the data that you'd normally pull while still having all your data be relative to each other.

### Features
- Parallel workers
- Partial table data
- Inject partials into other partials
- Merge or truncate data
- Watch mode (continually fetches new rows)
- Sync schema only

### [Quick start](quickstart.md)

### Thanks

*Inspired by the **awesome** Ruby library [pgsync](https://github.com/ankane/postgrab).*
