import * as fs from "fs";
import * as path from "path";

export function loadPrompt(): string {
    const filePath = path.join(
        process.cwd(),
        "src",
        "prompts",
        "scalping_futures_intraday.txt"
    );

    return fs.readFileSync(filePath, "utf-8");
}
