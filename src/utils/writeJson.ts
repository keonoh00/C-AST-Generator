import { Presets, SingleBar } from "cli-progress";
import fs from "fs";
import path from "path";
import v8 from "v8";

/**
 * Writes each item in `dataArray` as a JSON file to the corresponding path in `filePaths`.
 * Uses only JSON.stringify (no fallback to binary). If an item cannot be stringified,
 * this function will throw.
 *
 * @param dataArray Array of JSON-serializable values.
 * @param filePaths Array of full file paths (same length as `dataArray`).
 * @returns        An array of full file paths that were written.
 */
export function writeJSONFiles(dataArray: unknown[], filePaths: string[]): string[] {
  if (dataArray.length !== filePaths.length) {
    throw new Error("Length of dataArray and filePaths must match.");
  }

  const outputPaths: string[] = [];

  dataArray.forEach((item, index) => {
    const targetPath = filePaths[index].trim();
    const dir = path.dirname(targetPath);

    fs.mkdirSync(dir, { recursive: true });

    const jsonString = JSON.stringify(item);
    fs.writeFileSync(targetPath, jsonString, "utf-8");
    outputPaths.push(targetPath);
  });

  return outputPaths;
}

export function writeJSONWithChunkSize(nodes: unknown[], outputPaths: string[], chunkSize: number): void {
  if (nodes.length !== outputPaths.length) {
    console.error(`[fatal-error] Mismatched nodes and outputPaths lengths.`);
    return;
  }

  const bar = new SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: "Writing JSON Files |{bar}| {percentage}% || {value}/{total}",
      hideCursor: true,
    },
    Presets.shades_classic
  );

  bar.start(nodes.length, 0);

  for (let start = 0; start < nodes.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, nodes.length);
    const chunkNodes = nodes.slice(start, end);
    const chunkPaths = outputPaths.slice(start, end);

    chunkPaths.forEach((p) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
    });

    try {
      writeJSONFiles(chunkNodes, chunkPaths);
    } catch (e) {
      console.warn("[warn] Failed to write chunk:", e);
    }

    bar.increment(end - start);
  }

  bar.stop();
  console.log("[debug] All files written.");
}

/**
 * Serializes `data` (arbitrary JavaScript value) using V8’s binary format
 * and writes it to `filePath`. Creates directories as needed.
 *
 * @param data     Any JavaScript value (object, array, etc.).
 * @param filePath Full path (including filename) where the binary blob will be written.
 * @returns        The same `filePath` string, for convenience.
 */
export function writeLongJSONFiles(data: unknown, filePath: string): string {
  // Ensure the target directory exists
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  // Serialize with V8 → Buffer
  const buffer = v8.serialize(data);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
