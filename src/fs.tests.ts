import {deleteDirectory} from "./fs";
import * as path from "path";
import {compileTscProject} from "./tsc";

run();

async function run() {
    const source = path.resolve(__dirname, "../src");
    const out = __dirname;
    await compileTscProject({
        tsconfig: "src/tsconfig.json",
        source: ["src"],
        out: ["src_out"],
        verbose: true,
    });
}

async function deleteNonExistantDirectory(dirPath: string) {
    //
    //  Should not throw when directory does not exist
    //
    await deleteDirectory("../asdadas");
}
