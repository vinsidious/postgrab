# postgrab

> The **fast**, **fun**, and **easy** way to sync data between two databases 🚀✨

Postgrab is here to alleviate the burden of syncing your local and remote databases. What was once a slow, inflexible, and error-prone process is now fast, feature-filled, and fault-tolerant. With postgrab, you're able to sync **just** the data you need by defining [partials](configuration/file.md#partials) for your tables. The best part about partials is that they are able to inject/reference other partials! This lets you pull just a fraction of the data that you'd normally pull while still having all your data be relative to each other.

### Features

-   Parallel workers
-   Partial table data
-   Inject partials into other partials
-   Merge or truncate data
-   Sync schema only

# Quick Start

### Install

Add postgrab to your project's `package.json` under `devDependencies`, updating to the latest minor version, like:

```
  ...
  "devDependencies": {
     ...
     "@vinsidious/postgrab": "~X.Y.Z",
     ...
  }
  ...
```

### Configure and use

If you don't have your current node_modules on your `PATH`, run:

```
export PATH=$PATH:./node_modules/.bin
```

Start by running `postgrab` which will generate a very basic `.postgrab.yaml` config file in your current directory. You'll need to edit this file by filling in your local/remote database connection parameters. After that, you can run `postgrab --init` to begin the interactive configuration process.

During this process, postgrab gathers metadata from your remote database and presents you with some basic options for each of your tables. Your choices will be saved to your `.postgrab.yaml`. After interactive configuration is complete, you're all ready to start syncing data!

**Tip:** _You can always edit your `.postgrab.yaml` file manually to specify more advanced options like partials._

```bash
# Generate a .postgrab.yaml config file
postgrab

# Begin interactive configuration
postgrab --init

# Sync everything in your configuration
postgrab

# Later, sync specific tables
postgrab -t table1,table2
```

# Thanks

_Inspired by the **awesome** Ruby library [pgsync](https://github.com/ankane/pgsync)._
