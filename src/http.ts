import * as request from "request";
import {http, https} from "follow-redirects";
import * as fs from "fs";
import * as url from "url";

export function get(url): Promise<{response: any, body: string}> {
    return new Promise(function(resolve, reject) {
        request(url, function (error, response, body) {
            if(error) {
                reject(error);
                return;
            }

            resolve({
                response: response,
                body: body,
            });
        });
    });
}

export async function download(urlStr, dest) {
    return new Promise(function(resolve, reject) {
        try {
            var urlObj = url.parse(urlStr);
            const get = urlObj.protocol == "http" ? http.get : https.get;

            var file = fs.createWriteStream(dest);
            var request = get(urlStr, function (response) {
                const { statusCode } = response;

                if(statusCode!=200) {
                    reject(new Error("Server returned statusCode " + statusCode));
                }

                response.pipe(file);
                file.on('finish', function () {
                    resolve();
                });
            }).on('error', function (err) { // Handle errors
                fs.unlink(dest, function(){}); // Delete the file async. (But we don't check the result)
                reject(err);
            });
        }
        catch(err) {
            reject(err);
        }
    });
}

export interface HttpQueryParams {
    [key: string]: string
};

export function stringifyQueryParams<T>(obj: T, name: string = undefined): HttpQueryParams {
    const res = {};

    for(const key in obj) {
        const newKey = (name ? name + "." + key : key);

        const value = obj[key];
        const type = typeof value;
        if(value === null || value === undefined || type == "string" || type == "number" || type == "boolean") {
            res[newKey] = value.toString();
        }
        else if(type == "object") {
            const complex = stringifyQueryParams(value, newKey);
            Object.assign(res, complex);
        }
        else {
            throw new Error("Unexpected value at field " + key);
        }
    }

    return res;
}

export function parseQueryParams<T>(params: any): object {
    const res = {};

    for(const key in params) {
        const value = params[key];
        const parts = key.split(".");

        let obj = res;
        for(let i=0; i<parts.length; i++) {
            const part = parts[i];

            if(i == parts.length - 1) {
                obj[part] = value;
            }
            else {
                if(obj[part] === undefined) {
                    obj[part] = {};
                }

                obj = obj[part];
            }
        }
    }

    return res;
}

export interface HttpRequestOptions {
    method: string;
    url: string;
    data?: object;
    headers?: object;
    dontParseBody?: boolean;
}

export function httpRequest<T>(options: HttpRequestOptions): Promise<T> {
    return new Promise((resolve, reject)=> {
        const rawOptions: any = {
            method: options.method,
            url: options.url,
            headers: options.headers,
        };

        if(options.method.toUpperCase() == "GET") {
            rawOptions.qs = options.data;
        }
        else {
            rawOptions.json = options.data;
        }

        request(rawOptions,
            function (error, response, body) {
                if(error) {
                    reject(error);
                    return;
                }

                if(!response) {
                    reject(new Error("No response object"));
                    return;
                }

                if (response.statusCode != 200) {
                    if(body) {
                        reject(new HttpError(body.message || body.error || "HTTP response error", response.statusCode, response.statusMessage, body));
                    }
                    else {
                        reject(new Error("Server returned status code " + response.statusCode + ", " + response.statusMessage));
                    }

                    return;
                }

                try {
                    if(options.dontParseBody) {
                        resolve(body);
                        return;
                    }

                    if(!body) {
                        resolve(null);
                        return;
                    }

                    resolve(JSON.parse(body));
                }
                catch(err) {
                    reject(err);
                }
            }
        );
    });
}

export class HttpError extends Error {
    constructor(message: string, public statusCode: number, public statusMessage?: string, public body?: any) {
        super(message);
    }
}
