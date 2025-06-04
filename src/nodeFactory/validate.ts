import { promises as fs } from "fs";
import * as path from "path";

import { RawASTNodes } from "@/types/ASTNodes/RawNodes";

import { ASTValidator } from "./validator";

/**
 * Recursively reads and validates all JSON files in a directory.
 * @param dirPath Root directory to scan.
 * @returns Array of valid ASTNode objects.
 */
export async function readJsonFiles(dirPath: string): Promise<RawASTNodes[]> {
  const validator = new ASTValidator();
  let results: RawASTNodes[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await readJsonFiles(fullPath);
      results = results.concat(nested);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      try {
        const raw: unknown = JSON.parse(await fs.readFile(fullPath, "utf8"));

        try {
          validator.validate(raw);
          results.push(raw as RawASTNodes);
        } catch (validationError) {
          console.error(`Validation failed for ${fullPath}:\n`, (validationError as Error).message);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing ${fullPath}: ${msg}`);
      }
    }
  }

  return results;
}
