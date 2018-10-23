import {spawn} from "./process";
import * as path from "path";
import {createLogger} from "./logger";

const logger = createLogger("oc-tools:cli");

const commands = {};

class CLIError {
    constructor(public message) {
    }
}

export function command(name, action) {
    commands[name] = {
        name: name,
        action: action,
    };
}

export async function run() {
    try {
        const args = parseCliArgs();

        if (!args.command) {
            throw new CLIError("No command was specified");
        }

        const command = commands[args.command];
        if (!command) {
            throw new CLIError("Command \"" + args.command + "\" was not found");
        }

        const before = new Date();
        logger.debug("Running command \"" + args.command + "\"");

        await command.action(args.commandOptions);

        const after = new Date();
        logger.debug("Command \"" + args.command + "\" completed within " + (after.valueOf() - before.valueOf()) / 1000 + " secs");
    }
    catch(err) {
        logger.error(err.message);
    }
}

//
//  for example, "bu dev --log -env qa -package simple"
//  -log is added to options
//  command is dev
//  env with value qa is added to commandOptions
//  package with value simple is added to commandOptions
//
export interface CliArgs {
    options: any;
    command: string;
    commandOptions: any;
}

export function parseCliArgs(): CliArgs {
    const args: CliArgs = {
        options: {},
        command: null,
        commandOptions: {},
    };

    const argv = process.argv;
    let i=0;

    for(i=2; i<argv.length; i++) {
        const arg = argv[i];

        if(arg.startsWith("--")) {
            const optionName = arg.substring(2);
            let optionValue = undefined;

            if(argv[i+1] && !argv[i+1].startsWith("-")) {
                optionValue = argv[i+1];
                i++;
            }

            args.options[optionName] = optionValue;
        }
        else if(arg.startsWith("-")) {
            const optionName = arg.substring(1);
            let optionValue = undefined;

            if(argv[i+1] && !argv[i+1].startsWith("-")) {
                optionValue = argv[i+1];
                i++;
            }

            args.commandOptions[optionName] = optionValue;
        }
        else {
            if(args.command) {
                throw new Error("Must specify no more than one command");
            }

            args.command = arg;
        }
    }

    return args;
}

export function parseArgs() {
    const args = {};

    const argv = process.argv;
    let i=0;

    for(i=2; i<argv.length; i++) {
        const arg = argv[i];

        if(arg.startsWith("--")) {
            const optionName = arg.substring(2);
            let optionValue = undefined;

            if(argv[i+1] && !argv[i+1].startsWith("-")) {
                optionValue = argv[i+1];
                i++;
            }

            args[optionName] = optionValue;
        }
    }

    return args;
}

export interface DelegateOptions {
    tsconfig: string;
    main: string;
    log: boolean;
    useTsConfigBuild: boolean;
}

export async function bootstrap(options: DelegateOptions) {
    try {
        const cwd = process.cwd();
        logger.debug(cwd);
        options = options || <any>{};
        options.main = path.resolve(cwd, options.main || "./build_out/main.js");
        options.tsconfig = path.resolve(cwd, options.tsconfig || "./build/tsconfig.json");

        logger.debug("cli " + process.argv.slice(2).join(""));

        logger.debug("Compiling build scripts");
        await spawn("node_modules/.bin/tsc", [options.useTsConfigBuild ? "-b" : "-p", options.tsconfig], {
            shell: true
        });

        const build = require(options.main);
        const command = process.argv[2];
        if (!command) {
            throw new Error("Missing command to execute");
        }

        const func = build[command];
        if (!func) {
            throw new Error("Exported function " + command + " was not found");
        }

        await func(parseArgs());
    }
    catch(err) {
        console.error(err);
    }
}
