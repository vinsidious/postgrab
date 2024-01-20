"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const lodash_1 = __importDefault(require("lodash"));
const shlex_1 = __importDefault(require("shlex"));
const exec = execAsync;
exec.sync = execSync;
exports.default = exec;
function execAsync(command, options = {}) {
    const commands = splitCommands(command);
    const { quiet = true } = options;
    return new Promise((resolve, reject) => {
        const processes = lodash_1.default.map(commands, (cmd) => spawnCommand(cmd));
        let stdout = '';
        let stderr = '';
        lodash_1.default.forEach(processes, (proc, i) => {
            if (i === processes.length - 1) {
                if (!quiet)
                    pipeProcessOutput(proc.stdout, process.stdout);
                proc.stdout.on(`data`, (d) => (stdout += d));
                proc.stderr.on(`data`, (d) => (stderr += d));
                proc.on(`close`, (code) => code > 0 ? reject(lodash_1.default.trim(stderr)) : resolve(lodash_1.default.trim(stdout)));
            }
            else {
                pipeProcessOutput(proc.stdout, processes[i + 1].stdin);
            }
            proc.on(`error`, reject);
            if (!quiet)
                pipeProcessOutput(proc.stderr, process.stdout);
        });
    });
}
function execSync(command) {
    const commands = splitCommands(command);
    const [cmd, args] = lodash_1.default.size(commands) > 1
        ? [`/bin/sh`, [`-c`, `"${commands.join(` | `)}"`]]
        : splitCommand(commands[0]);
    const { stdout, stderr, error } = (0, child_process_1.spawnSync)(cmd, args);
    if (error) {
        throw error;
    }
    else if (!!stderr) {
        throw new Error(stderr);
    }
    return lodash_1.default.trim(stdout);
}
function pipeProcessOutput(source, target) {
    source.pipe(target);
}
function spawnCommand(command) {
    const [cmd, args] = splitCommand(command);
    return (0, child_process_1.spawn)(cmd, args);
}
function splitCommand(command) {
    const args = shlex_1.default.split(command);
    const cmd = args.shift();
    return [cmd, args];
}
function splitCommands(cmd) {
    cmd = fixMultipleSpaces(cmd);
    return /.*[^|]\|[^|].*/.test(cmd) ? cmd.split(/\s?\|\s?/) : [cmd];
}
function fixMultipleSpaces(str) {
    return str.replace(/\s+/g, ` `);
}
