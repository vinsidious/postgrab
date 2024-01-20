# Quick Start

### Install

You should install `postgrab` as one of your `devDependencies` or `optionalDependencies`:

```
pnpm add -D @vinsidious/postgrab
```

### Configure and use

Start by running `postgrab` which will generate a very basic `.postgrab.yaml` config file in your current directory. You'll need to edit this file by filling in your local/remote database connection parameters. After that, you can run `postgrab --init` to begin the interactive configuration process.

During this process, postgrab gathers metadata from your remote database and presents you with some basic options for each of your tables. Your choices will be saved to your `.postgrab.yaml`. After interactive configuration is complete, you're all ready to start syncing data!

**Tip:** *You can always edit your `.postgrab.yaml` file manually to specify more advanced options like partials.*

```bash
# Generate a .postgrab.yaml config file
postgrab

# Begin interactive configuration
postgrab --init

# Sync
postgrab -t table1,table2
```
