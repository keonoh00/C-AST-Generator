import { promises as fs } from "fs";
import * as path from "path";

/**
 * Recursively collects all .json file paths under a directory.
 * @param dirPath Root directory to scan.
 * @returns Array of full file paths to .json files.
 */
export async function listJsonFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await listJsonFiles(fullPath);
      paths.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      paths.push(fullPath);
    }
  }

  return paths;
}
