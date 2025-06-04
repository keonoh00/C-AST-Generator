import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Writes each item in `dataArray` as a separate JSON file into the corresponding directory in `dirPaths`.
 * If a directory path is missing or empty, a unique random directory will be generated for that file.
 *
 * @param dataArray Array of JSON-serializable values.
 * @param dirPaths Array of directory paths (same length as `dataArray`).
 * @returns An array of full file paths written.
 */
export function writeJSONFiles(dataArray: unknown[], dirPaths: (string | undefined)[]): string[] {
  if (dataArray.length !== dirPaths.length) {
    throw new Error("Length of dataArray and dirPaths must match.");
  }

  const outputPaths: string[] = [];

  const padLength = dataArray.length.toString().length;

  dataArray.forEach((item, index) => {
    const rawDir = dirPaths[index];
    const resolvedDir = rawDir?.trim() ?? path.resolve(process.cwd(), crypto.randomBytes(8).toString("hex"));

    fs.mkdirSync(resolvedDir, { recursive: true });

    const filename = `${String(index).padStart(padLength, "0")}.json`;
    const filePath = path.join(resolvedDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(item, null, 2), "utf-8");

    outputPaths.push(filePath);
  });

  return outputPaths;
}
