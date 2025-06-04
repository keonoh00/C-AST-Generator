import { Presets, SingleBar } from "cli-progress";
import { promises as fs } from "fs";
import * as path from "path";

/**
 * Recursively reads all .json files from a directory and parses them,
 * displaying a progress bar as it processes each file.
 * @param dirPath Root directory to search.
 * @returns Array of parsed JSON objects as unknown[].
 */
export async function readJsonFiles(dirPath: string): Promise<unknown[]> {
  // First, collect all JSON file paths
  const filePaths = await collectJsonFilePaths(dirPath);
  const jsonObjects: unknown[] = [];

  // Initialize progress bar
  const bar: SingleBar = new SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: "Reading JSON files |{bar}| {percentage}% || {value}/{total} files",
      hideCursor: true,
    },
    Presets.shades_classic
  );
  bar.start(filePaths.length, 0);

  // Read and parse each file, updating the progress bar
  for (const fullPath of filePaths) {
    try {
      const content = await fs.readFile(fullPath, "utf8");
      jsonObjects.push(JSON.parse(content));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error reading ${fullPath}: ${msg}`);
    }
    bar.increment();
  }

  bar.stop();
  return jsonObjects;
}

/**
 * Recursively collects all .json file paths under a directory.
 * @param dirPath Root directory to scan.
 * @returns Array of full file paths to .json files.
 */
async function collectJsonFilePaths(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJsonFilePaths(fullPath);
      paths.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      paths.push(fullPath);
    }
  }

  return paths;
}
