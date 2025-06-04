import { Presets, SingleBar } from "cli-progress";
import { promises as fs } from "fs";

/**
 * Recursively reads all .json files from a directory and parses them,
 * displaying a progress bar as it processes each file.
 * @param dirPath Root directory to search.
 * @returns Array of parsed JSON objects as unknown[].
 */
export async function readJsonFiles(dirPaths: string[]): Promise<unknown[]> {
  // First, collect all JSON file paths
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
  bar.start(dirPaths.length, 0);

  // Read and parse each file, updating the progress bar
  for (const fullPath of dirPaths) {
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
