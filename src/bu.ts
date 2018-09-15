import {readJSONFile, replaceExt} from "./fs";
import {parseCliArgs} from "./cli";
import {createLogger} from "./logger";
const fs = require("fs");
const path = require("path");
const {isFile} = require("./fs");
const {exec} = require("./process");
const cwd = process.cwd();

run();

const logger = createLogger("bu");

async function run() {
    const args = parseCliArgs();

    const mainTs = path.join(cwd, "build/main.ts");
    let foundTsConfig: string = null;
    let foundMainJs: string = null;

    if (await isFile(mainTs)) {
        logger.debug("Found build/main.ts at " + mainTs);

        const tsConfigs = [
            path.join(cwd, "build/tsconfig.json"),
            path.join(cwd, "tsconfig.json")
        ];

        for(let tsConfig of tsConfigs) {
            if (await isFile(tsConfig)) {
                foundTsConfig = tsConfig;
                logger.debug("Compiling tsconfig.json at " + tsConfig);
                await exec(`node_modules/.bin/tsc -p "${tsConfig}"`);
                const config = await readJSONFile(tsConfig);
                if(config.compilerOptions.outDir) {
                    logger.debug("tsc outDir is " + config.compilerOptions.outDir);
                    foundMainJs = path.join(tsConfig, "..", config.compilerOptions.outDir, "main.js");
                }
                else {
                    logger.debug("Not tsc outDir was found");
                    foundMainJs = replaceExt(mainTs, "js");
                }
                break;
            }
        }

        if(!foundTsConfig) {
            logger.debug("Compiling main.ts at " + mainTs);
            await exec(`node_modules/.bin/tsc ${mainTs}`);
            foundMainJs = path.join(cwd, "build/main.js");
        }
    }

    if (!foundMainJs) {
        logger.error("Main build script was not found");
        return;
    }

    if (!await isFile(foundMainJs)) {
        logger.error("Main build script was not found at " + foundMainJs);
        return;
    }

    logger.debug("Loading " + foundMainJs);
    require(foundMainJs);
}
