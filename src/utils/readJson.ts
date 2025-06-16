import { Presets, SingleBar } from "cli-progress";
import fs from "fs";
import fsPromises from "fs/promises";
import v8 from "v8";

/**
 * Reads and parses each file path in `filePaths`, displaying a progress bar.
 * Uses the promise-based API so `await` operates on a real Promise.
 *
 * @param filePaths Array of full paths to .json files.
 * @returns An array of parsed JSON objects.
 */
export async function readJSONFiles(filePaths: string[]): Promise<unknown[]> {
  const jsonObjects: unknown[] = [];

  const bar = new SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: "Reading JSON files |{bar}| {percentage}% || {value}/{total} files",
      hideCursor: true,
    },
    Presets.shades_classic
  );

  bar.start(filePaths.length, 0);

  for (const fullPath of filePaths) {
    try {
      const content = await fsPromises.readFile(fullPath, "utf8");
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
 * Reads a single V8‐serialized binary file from `filePath` and deserializes it back into an `unknown`.
 * Caller is responsible for casting to the correct type (e.g. `ParserASTNode[]`).
 *
 * @param filePath Full path to a file previously written via `writeLongJSONFiles`.
 * @returns        The deserialized value as `unknown`.
 */
export function readLongJSONFiles(filePath: string): unknown {
  // Read the raw binary Buffer
  const buffer = fs.readFileSync(filePath);
  // Deserialize back to `unknown`
  return v8.deserialize(buffer);
}
