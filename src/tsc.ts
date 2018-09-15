import * as path from "path";
import {copyFile, directoryExists, fileExists, searchGlob} from "./fs";
import {stat} from "./fs";
import {spawn} from "./process";

export interface CompileTscProjectOptions {
    tsc?: string;
    tsconfig?: string;
    source?: string[];
    exclude?: string[];
    out?: string[];
    verbose?: boolean;
}

async function isDirectoryModified(source: string, out: string, verbose: boolean, exclude: string[]) {
    if(!await directoryExists(source)) {
        throw new Error("Directory " + source + " does not exist");
    }

    if(!await directoryExists(out)) {
        return true;
    }

    const sourceFiles = await searchGlob(source + "/**/*.ts", {
        ignore: exclude,
    });

    for (const sourceFile of sourceFiles) {
        const sourceFullPath = path.resolve(sourceFile);
        const sourceRelPath = sourceFullPath.substring(source.length + 1);
        const parsed = path.parse(sourceRelPath);

        const outFullPath = sourceRelPath.endsWith(".d.ts") ? path.resolve(out, sourceRelPath) : path.resolve(out, parsed.dir, parsed.name + ".js");
        if (!await fileExists(outFullPath)) {
            if (verbose) {
                console.log("File " + outFullPath + " does not exist");
            }

            return true;
        }

        const sourceModifiedTime = (await stat(sourceFullPath)).mtime;
        const outModifiedTime = (await stat(outFullPath)).mtime;

        if (sourceModifiedTime > outModifiedTime) {
            if (verbose) {
                console.log("File " + sourceFullPath + " was modified");
            }

            return true;
        }
    }

    return false;
}

export async function compileTscProject(options: CompileTscProjectOptions) {
    const verbose = options.hasOwnProperty("verbose") ? options.verbose : false;
    const tsconfig = options.tsconfig || "./tsconfig.json";
    const exclude = (options.exclude || []).map(x => "**/" + x + "/**")

    if(options.source.length != options.out.length) {
        throw new Error("source & out must have the same length");
    }

    const sources = options.source.map(x => path.resolve(x));
    const outs = options.out.map(x => path.resolve(x));

    let modified = false;

    for(let i=0; i<sources.length; i++) {
        const source = sources[i];
        const out = outs[i];

        if (await isDirectoryModified(source, out, verbose, exclude)) {
            modified = true;
            break;
        }
    }

    if(modified) {
        if(verbose) {
            console.log("Compiling project " + tsconfig);
        }

        await spawn("node_modules/.bin/tsc", ["-p", tsconfig], {
            shell: true
        });

        for(let i=0; i<sources.length; i++) {
            const source = sources[i];
            const out = outs[i];
            const sourceFiles = await searchGlob(source + "/**/*.d.ts");
            console.log(sourceFiles);
            for (const sourceFile of sourceFiles) {
                const sourceFullPath = path.resolve(sourceFile);
                const sourceRelPath = sourceFullPath.substring(source.length + 1);
                const outFullPath = path.resolve(out, sourceRelPath);
                await copyFile(sourceFullPath, outFullPath, verbose);
            }
        }
    }
    else {
        if(verbose) {
            console.log("Project " + tsconfig + " has no changes");
        }
    }

    return false;
}
