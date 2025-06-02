import { promises as fs } from "fs";
import * as path from "path";

import { RawASTNodes } from "@/types/ASTNodes/RawNodes";

/**
 * Recursively reads and validates all JSON files in a directory.
 * @param dirPath Root directory to scan.
 * @returns Array of valid ASTNode objects.
 */
export async function readJsonFiles(dirPath: string): Promise<RawASTNodes[]> {
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
        if (isASTNode(raw)) {
          results.push(raw);
        } else {
          console.error(`Invalid RawASTNodes in ${fullPath}`, raw);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing ${fullPath}: ${msg}`);
      }
    }
  }

  return results;
}

function isASTNode(obj: unknown): obj is RawASTNodes {
  if (!isObject(obj)) return false;
  switch (obj._nodetype) {
    default:
      return true; // assume other ASTNode types are valid
  }
}

// Type predicate helper to check for plain objects
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
