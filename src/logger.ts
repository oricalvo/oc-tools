import {createLogger as createWinstonLogger, format, Logger as WinstonLogger, transports} from "winston";
import {ServiceToken, resolveService, tryResolveService} from "./serviceLocator";
import * as moment from "moment";
const { printf } = format;

const pid = process.pid;

export const LOGGER = new ServiceToken<WinstonLogger>("LOGGER");

export interface Logger {
    debug(message: string);
    warn(message: string);
    error(message: string);
}

export function createLogger(name: string): Logger {
    return new ModuleLogger(name);
}

export class NullLogger implements Logger {
    debug(...args) {
    }

    warn(...args) {
    }

    error(...args) {
    }
}

export function createAppLogger(appName: string, filePath: string): WinstonLogger {
    const format = printf(info => {
        const prefix = `${pid} ${appName}${info.moduleName ? "/" + info.moduleName : ""}`;
        return `${moment().format("HH:mm:ss:SSS")} ${info.level.toUpperCase()} ${prefix} ${info.message}`;
    });

    const logger = createWinstonLogger({
        level: "debug",
        format: format,
        transports: [
            new transports.Console({}),
            new transports.File({filename: filePath})
        ],
    });

    return logger;
}

export class ModuleLogger {
    private logger: WinstonLogger;
    private disabled: boolean = false;

    constructor(public name: string) {
    }

    private ensureInit() {
        if(!this.logger) {
            this.logger = tryResolveService(LOGGER);
            if(!this.logger) {
                this.disabled = true;
                this.logger = <any>new NullLogger();
            }
        }
    }

    disable() {
        this.disabled = true;
    }

    debug(msg: string) {
        this.ensureInit();

        if(this.disabled) {
            return;
        }

        this.logger.debug(msg, {
            moduleName: this.name,
        });
    }

    warn(msg: string) {
        this.ensureInit();

        if(this.disabled) {
            return;
        }

        this.logger.warn(msg, {
            moduleName: this.name,
        });
    }

    error(msg: string, ...meta: any[]) {
        this.ensureInit();

        if(this.disabled) {
            return;
        }

        this.logger.error(msg, {
            moduleName: this.name,
        });
    }
}
