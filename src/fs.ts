import * as fs from "fs";
import {Stats} from "fs";
import * as fsExtra from "fs-extra/lib";
import * as glob from "glob";
import * as path from "path";
import * as minimatch from "minimatch";
import {promisifyNodeFn1} from "./promise";
import {LimitConcurrency} from "./tasks";
import * as chokidar from "chokidar";
import {promisify} from "util";

const stat = promisify(fs.stat);
const mkdir = promisify(fsExtra.mkdir);
const ensureDir = promisify(fsExtra.ensureDir);
const remove = promisify(fsExtra.remove);
const copy = promisify(fsExtra.copy);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fsExtra.appendFile);

export async function directoryExists(path) {
    try {
        const info = await stat(path);
        return info.isDirectory();
    }
    catch(err) {
        if(err.code == "ENOENT") {
            return false;
        }

        throw err;
    }
}

export async function fileExists(path) {
    try {
        const info = await stat(path);
        return info.isFile();
    }
    catch(err) {
        if(err.code == "ENOENT") {
            return false;
        }

        throw err;
    }
}

export async function deleteDirectory(path) {
    try {
        const isDir = await directoryExists(path);
        if (!isDir) {
            return;
        }

        await remove(path);
    }
    catch(err) {
        if(err.code == "ENOENT") {
            return;
        }

        throw err;
    }
}

export function createDirectory(path) {
    return mkdir(path);
}

export function ensureDirectory(path) {
    return fsExtra.ensureDir(path);
}

function getGlobBase(pattern) {
    let base = "";
    let hasMagic = false;
    const parts = pattern.split("/");
    for(let part of parts) {
        if(!glob.hasMagic(part)) {
            if(base != "") {
                base += "/";
            }

            base += part;
        }
        else {
            hasMagic = true;
            break;
        }
    }

    if(!hasMagic) {
        return null;
    }

    return base;
}

export async function copyGlob(pattern, dest, options?): Promise<void> {
    const base = getGlobBase(pattern);
    const files = await searchGlob(pattern, options);
    return copyFiles(files, base, dest);
}

export function deleteGlob(pattern) {
    return new Promise(function(resolve, reject) {
        glob(pattern, {}, function (er, files) {
            Promise.all(files.map(file => {
                deleteFile(file);
            })).then(() => {
                resolve();
            }).catch(err => {
                reject(err);
            });
        });
    });
}

export function copyFile(from, to, ignoreDir = false): Promise<void> {
    return Promise.resolve().then(()=> {
        return stat(from).then(stat => {
            if (stat.isDirectory()) {
                if (!ignoreDir) {
                    throw new Error("Specified path is a directory");
                }
            }
            else {
                return copy(from, to);
            }
        });
    });
}

export function copyFiles(files, base, dest): Promise<void> {
    return <any>Promise.all(files.map(file => {
        const relativeName = file.substring(base.length);
        return copyFile(file, path.posix.join(dest, relativeName), true)
    }));
}

export async function deleteFile(path) {
    try {
        const info = await stat(path);
        if(!info.isFile()) {
            throw new Error("Specified path \"" + path + "\" is not a file");
        }

        await fsExtra.remove(path);
    }
    catch(err) {
        if(err.code == "ENOENT") {
            return;
        }

        throw err;
    }
}

export async function readJSONFile(path) {
    const text: any = await readFile(path, "utf8");
    const obj = JSON.parse(text);
    return obj;
}

export async function writeJSONFile(path, obj, ident?) {
    const text = JSON.stringify(obj, null, ident);
    await writeFile(path, text, "utf8");
}

export const searchGlob: (pattern: string, options?)=>Promise<string[]> = <any>promisify(glob);

export function excludeFiles(files, pattern) {
    return files.filter(file => {
        return !minimatch(file, pattern);
    });
}

export function replaceExt(filePath: string, ext: string) {
    const info  = path.parse(filePath);
    const res = path.join(info.dir, info.name + "." + ext);
    return res;
}

export const getDirectoryContent = promisifyNodeFn1<string, string[]>(fs.readdir);

export async function scanDirectoryTree(dirs: string|string[], callback: (file: string, index: number)=>void, concurrent: number): Promise<void> {
    if(typeof dirs == "string") {
        dirs = [dirs];
    }

    const queue = new LimitConcurrency(concurrent);
    let count = 0;

    for(const dir of dirs) {
        queue.run(async () => scanDir(dir));
    }

    async function scanDir(dir: string) {
        const names = await getDirectoryContent(dir);

        for (const name of names) {
            const fullPath = path.join(dir, name);

            queue.run(() => scanItem(fullPath));
        }
    }

    async function scanItem(fullPath: string) {
        const stats = await stat(fullPath)

        if (stats.isDirectory()) {
            queue.run(() => scanDir(fullPath));
        }
        else if (stats.isFile()) {
            try {
                queue.run(() => <any>callback(fullPath, ++count));
            }
            catch(err) {
                //  ignore errors
            }
        }
    }

    return queue.wait();
}

export function watchGlob(pattern, dest) {
    const base = getGlobBase(pattern);
    let ready = false;

    const watcher = chokidar.watch(pattern, {
        persistent: true
    });

    function resolveTarget(filePath) {
        if(!base) {
            //
            //  pattern is not a glob but rather a file
            //  in that case dest should be full path to target
            //
            return dest;
        }

        const rel = path.relative(base, filePath);
        const target = path.join(dest, rel);
        return target;
    }

    function onAddOrChange(filePath) {
        if(!ready) {
            return;
        }

        const target = resolveTarget(filePath);
        console.log("Copying modified file from " + filePath + " to " + target);
        return copyFile(filePath, target);
    }

    function onUnlink(filePath) {
        if(!ready) {
            return;
        }

        const target = resolveTarget(filePath);
        console.log("Deleting file from " + target);
        return deleteFile(target);
    }

    watcher.on("add", onAddOrChange);
    watcher.on("change", onAddOrChange);
    watcher.on("unlink", onUnlink);

    watcher.on('ready', () => {
        //
        //  Ready is fired once chokidar finished travresing the file tree and raise add event
        //
        ready = true;
    });
}

export async function copyAssets(assets: Asset[], watch: boolean): Promise<void> {
    await Promise.all(assets.map(a => {
        if(!getGlobBase(a.source)) {
            return copyFile(a.source, a.target);
        }

        return copyGlob(a.source, a.target);
    }));

    if(watch) {
        Promise.all(assets.map(a => {
            return watchGlob(a.source, a.target);
        }));
    }
}

export interface Asset {
    source: string;
    target: string;
}

export function waitForFileCreation(folder: string, relativeFilePath: string, createFolder?: boolean) {
    return new Promise((resolve, reject)=> {
        if(createFolder) {
            ensureDirectory(folder);
        }

        const watcher = chokidar.watch(folder, {
            persistent: true
        });

        watcher
            .on("add", filePath => {
                if (filePath == path.normalize(path.join(folder, relativeFilePath))) {
                    resolve();

                    //
                    //  For somereason the close method does not work inside the current tick
                    //
                    process.nextTick(()=> {
                        watcher.close();
                    });
                }
            })
            .on("error", err => {
                reject(err);

                process.nextTick(()=> {
                    //
                    //  For somereason the close method does not work inside the current tick
                    //
                    watcher.close();
                });
            });
    });
}
