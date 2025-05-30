import { promises as fs } from "fs";
import * as path from "path";

import { ArrayDeclNode, ArrayRefNode, AssignmentNode, ASTNode } from "@/types/ASTNodes/RawNodes";

/**
 * Recursively reads and validates all JSON files in a directory.
 * @param dirPath Root directory to scan.
 * @returns Array of valid ASTNode objects.
 */
export async function readJsonFiles(dirPath: string): Promise<ASTNode[]> {
  let results: ASTNode[] = [];
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
          console.error(`Invalid ASTNode in ${fullPath}`, raw);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error processing ${fullPath}: ${msg}`);
      }
    }
  }

  return results;
}

// --- Type Guard Functions ---
function isArrayDeclNode(obj: unknown): obj is ArrayDeclNode {
  if (!isObject(obj) || obj._nodetype !== "ArrayDecl") return false;
  const node = obj as unknown as ArrayDeclNode;
  const { children, dim_quals } = node;
  return Array.isArray(children.dim) && Array.isArray(children.type) && Array.isArray(dim_quals);
}

function isArrayRefNode(obj: unknown): obj is ArrayRefNode {
  if (!isObject(obj) || obj._nodetype !== "ArrayRef") return false;
  const node = obj as unknown as ArrayRefNode;
  const { children } = node;
  return Array.isArray(children.name) && Array.isArray(children.subscript);
}

function isAssignmentNode(obj: unknown): obj is AssignmentNode {
  if (!isObject(obj) || obj._nodetype !== "Assignment") return false;
  const node = obj as unknown as AssignmentNode;
  const { children, op } = node;
  return typeof op === "string" && Array.isArray(children.lvalue) && Array.isArray(children.rvalue);
}

function isASTNode(obj: unknown): obj is ASTNode {
  if (!isObject(obj)) return false;
  switch (obj._nodetype) {
    case "ArrayDecl":
      return isArrayDeclNode(obj);
    case "ArrayRef":
      return isArrayRefNode(obj);
    case "Assignment":
      return isAssignmentNode(obj);
    default:
      return true; // assume other ASTNode types are valid
  }
}

// Type predicate helper to check for plain objects
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
