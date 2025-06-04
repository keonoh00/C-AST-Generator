import { ParserASTNode, ParserKind } from "@/types/PyCParser/pycparser";

const KNOWN_NODE_TYPES = new Set<string>(Object.values(ParserKind));

interface ValidationError {
  message: string;
  path: string;
}

/**
 * Recursively checks that a parsed JSON object matches the ASTNodeJSON schema.
 * Usage:
 *   const validator = new ASTValidator();
 *   validator.validate(someJson); // throws if invalid
 */
export class ASTValidator {
  private errors: ValidationError[] = [];

  /** Return all accumulated validation errors (empty if none). */
  public getErrors(): ValidationError[] {
    return this.errors;
  }

  /**
   * Validate a parsed JSON object against the ASTNodeJSON schema.
   * @param obj  The JSON‐parsed object to validate.
   * @returns    `true` if valid, otherwise throws an Error listing all mismatches.
   */
  public validate(obj: unknown): obj is ParserASTNode {
    this.errors = [];
    this.checkNode(obj, "root");
    if (this.errors.length > 0) {
      const msg = this.errors.map((e, i) => `${String(i + 1)}. [${e.path}] ${e.message}`).join("\n");
      throw new Error("AST validation failed:\n" + msg);
    }
    return true;
  }

  /** Internal: validate the `children` property. */
  private checkChildren(value: unknown, path: string): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      this.reportError(path, "Expected `children` to be an object");
      return;
    }
    const children = value as Record<string, unknown>;
    for (const [childKey, childVal] of Object.entries(children)) {
      const childPath = `${path}.${childKey}`;
      if (Array.isArray(childVal)) {
        // Must be a non‐empty array of AST nodes
        if (childVal.length === 0) {
          this.reportError(childPath, "Expected at least one child node");
          continue;
        }
        for (let i = 0; i < childVal.length; i++) {
          // Wrap i in String(...) so we’re not interpolating a raw number
          this.checkNode(childVal[i], `${childPath}[${String(i)}]`);
        }
      } else {
        // Single node object
        this.checkNode(childVal, childPath);
      }
    }
  }

  /** Internal: validate that `value` is a valid ASTNodeJSON at the given path. */
  private checkNode(value: unknown, path: string): void {
    if (typeof value !== "object" || value === null) {
      this.reportError(path, "Expected an object for AST node");
      return;
    }
    const node = value as Record<string, unknown>;

    // 1) `_nodetype` must be a string in KNOWN_NODE_TYPES
    const nt = node._nodetype;
    if (typeof nt !== "string") {
      this.reportError(path + "._nodetype", "Missing or non‐string `_nodetype`");
      return;
    }
    if (!KNOWN_NODE_TYPES.has(nt)) {
      this.reportError(path + "._nodetype", `Unknown node type "${nt}"`);
      // Continue validating children/props even if nodetype is unrecognized
    }

    // 2) Iterate through all fields on the node
    for (const [key, val] of Object.entries(node)) {
      if (key === "_nodetype") {
        continue;
      }
      if (key === "children") {
        this.checkChildren(val, path + ".children");
      } else {
        // Primitive prop or string‐array prop
        this.checkPrimitiveProp(val, `${path}.${key}`);
      }
    }
  }

  /** Internal: validate an array of primitives (strings/numbers/booleans/null). */
  private checkPrimitiveArray(arr: unknown[], path: string): void {
    if (arr.length === 0) {
      // Empty array is allowed (e.g. `quals: []`)
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      const elem = arr[i];
      if (elem === null) {
        continue;
      }
      const t = typeof elem;
      if (t !== "string" && t !== "number" && t !== "boolean") {
        // Convert i to string explicitly
        this.reportError(`${path}[${String(i)}]`, `Expected primitive but got ${JSON.stringify(elem)}`);
      }
    }
  }

  /** Internal: validate “primitive” props (strings, numbers, booleans, null, or arrays thereof). */
  private checkPrimitiveProp(value: unknown, path: string): void {
    if (value === null) {
      return; // `null` is allowed
    }
    switch (typeof value) {
      case "boolean":
      case "number":
      case "string":
        return;
      case "object":
        if (Array.isArray(value)) {
          this.checkPrimitiveArray(value, path);
          return;
        }
        break;
    }
    this.reportError(path, `Invalid primitive value: ${JSON.stringify(value)}`);
  }

  /** Record a validation error at the given path. */
  private reportError(path: string, message: string): void {
    this.errors.push({ message, path });
  }
}
