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

class NullLogger implements Logger {
    debug(...args) {
    }

    warn(...args) {
    }

    error(...args) {
    }
}

export function createAppLogger(appName: string, filePath: string): WinstonLogger {
    const format = printf(info => {
        const prefix = `${appName}(${pid})${info.moduleName ? ":" + info.moduleName : ""}`;
        return `${moment().format("HH:mm:ss:SSS")} ${prefix} ${info.level.toUpperCase()}: ${info.message}`;
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
    private _logger: WinstonLogger;
    private _disabled: boolean = false;

    constructor(public name: string) {
    }

    private get logger() {
        if(!this._logger) {
            this._logger = tryResolveService(LOGGER);
            if(!this._logger) {
                this._disabled = true;
            }
        }

        return this._logger;
    }

    disable() {
        this._disabled = true;
    }

    debug(msg: string) {
        if(this._disabled) {
            return;
        }

        this.logger.debug(msg, {
            moduleName: this.name,
        });
    }

    warn(msg: string) {
        if(this._disabled) {
            return;
        }

        this.logger.warn(msg, {
            moduleName: this.name,
        });
    }

    error(msg: string, ...meta: any[]) {
        if(this._disabled) {
            return;
        }

        this.logger.error(msg, {
            moduleName: this.name,
        });
    }
}
