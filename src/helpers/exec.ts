import { ChildProcess, spawn, spawnSync } from 'child_process'
import _ from 'lodash'
import shlex from 'shlex'

import { Exec, ExecOptions } from '../interfaces'

const exec = <Exec>execAsync
exec.sync = execSync

export default exec

function execAsync(command: string, options: ExecOptions = {}): Promise<string> {
    const commands = splitCommands(command)
    const { quiet = true } = options

    return new Promise((resolve, reject) => {
        const processes = _.map(commands, (cmd) => spawnCommand(cmd))

        let stdout = ''
        let stderr = ''

        _.forEach(processes, (proc: any, i: number) => {
            if (i === processes.length - 1) {
                if (!quiet) pipeProcessOutput(proc.stdout, process.stdout)
                proc.stdout.on(`data`, (d) => (stdout += d))
                proc.stderr.on(`data`, (d) => (stderr += d))
                proc.on(`close`, (code) =>
                    code > 0 ? reject(_.trim(stderr)) : resolve(_.trim(stdout)),
                )
            } else {
                pipeProcessOutput(proc.stdout, processes[i + 1].stdin)
            }
            proc.on(`error`, reject)
            if (!quiet) pipeProcessOutput(proc.stderr, process.stdout)
        })
    })
}

function execSync(command: string): string {
    const commands = splitCommands(command)
    const [cmd, args] =
        _.size(commands) > 1
            ? [`/bin/sh`, [`-c`, `"${commands.join(` | `)}"`]]
            : splitCommand(commands[0])
    const { stdout, stderr, error } = spawnSync(cmd, args)
    if (error) {
        throw error
    } else if (!!stderr) {
        throw new Error(stderr)
    }
    return _.trim(stdout)
}

function pipeProcessOutput(source: NodeJS.ReadableStream, target: NodeJS.WritableStream): void {
    source.pipe(target)
}

function spawnCommand(command: string): ChildProcess {
    const [cmd, args] = splitCommand(command)
    return spawn(cmd, args)
}

function splitCommand(command: string): any {
    const args = shlex.split(command)
    const cmd = args.shift()
    return [cmd, args]
}

function splitCommands(cmd: string): string[] {
    cmd = fixMultipleSpaces(cmd)
    // Split the command if we detect any pipe characters
    return /.*[^|]\|[^|].*/.test(cmd) ? cmd.split(/\s?\|\s?/) : [cmd]
}

function fixMultipleSpaces(str: string): string {
    return str.replace(/\s+/g, ` `)
}
