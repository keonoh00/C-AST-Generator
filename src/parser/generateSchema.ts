import { execSync } from "child_process";
import fs from "fs";
import path from "path";

import { pycparserCfg } from "@/parser/schema/pycparser";

interface ParsedField {
  comment: string;
  name: string;
  optional: boolean;
  type: string;
}

/**
 * Parse a single field token from the config.
 * - If it ends with "**", it's a list of child nodes → ParserASTNode[].
 * - If it ends with "*", it's a single child node → ParserASTNode.
 * - Otherwise it's an attribute → primitive or nullable.
 */
function parseField(field: string): ParsedField {
  let name = field;
  let type: string;
  let comment = "";
  let optional = false;

  if (field.endsWith("**")) {
    name = field.slice(0, -2);
    type = "ParserASTNode[]";
    comment = "Sequence of child AST nodes";
  } else if (field.endsWith("*")) {
    name = field.slice(0, -1);
    type = "ParserASTNode";
    comment = "Child AST node";
  } else {
    type = "string | number | boolean | null";
    comment = "Literal or attribute";
    optional = true;
  }

  return { comment, name, optional, type };
}

/**
 * Given a nodeType (e.g. "FuncDef") and its list of raw fields (["decl*", "param_decls**", "body*"]),
 * produce a TypeScript interface string:
 *
 *   /** AST node for `FuncDef` *\/
 *   export interface IParserFuncDefNode extends ParserBaseASTNode {
 *     kind: ParserKind.FuncDef;
 *     /** Child AST node *\/
 *     decl: ParserASTNode;
 *     /** Sequence of child AST nodes *\/
 *     param_decls: ParserASTNode[];
 *     /** Child AST node *\/
 *     body: ParserASTNode;
 *     /** All nested child nodes (zero, one, or many) *\/
 *     children?: ParserASTNode[];
 *     /** Source coordinate *\/
 *     coord: string;
 *   }
 */
function toInterface(nodeType: string, fields: string[]): string {
  // parse each field token into { name, type, comment, optional }
  const parsedFields = fields.map(parseField);

  // Documentation comment for this interface
  const doc = `/** AST node for \`${nodeType}\` */`;

  // The mandatory "kind" field
  const kindField = `  kind: ParserKind.${nodeType};`;

  // Build lines for each parsed field: doc + declaration
  const memberLines = parsedFields.map((f) => {
    const docLine = `  /** ${f.comment} */`;
    const declLine = `  ${f.name}${f.optional ? "?" : ""}: ${f.type};`;
    return `${docLine}\n${declLine}`;
  });

  // Always include explicit "children" and "coord" at the end
  memberLines.push(
    `  /** All nested child nodes (zero, one, or many) */`,
    `  children?: ParserASTNode[];`,
    `  /** Source coordinate, e.g. "file.c:23:5" */`,
    `  coord: string;`
  );

  const members = memberLines.join("\n");
  return `${doc}
export interface IParser${nodeType}Node extends ParserBaseASTNode {
${kindField}
${members}
}
`;
}

// 1) Split config into non-empty, non-comment lines
const lines = pycparserCfg
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l !== "" && !l.startsWith("#"));

const interfaces: string[] = [];
const typeNames: string[] = [];
const kindMapEntries: string[] = [];

// 2) For each line "NodeName: [field1, field2*, field3**]" → generate interface + type name + map entry
for (const line of lines) {
  const [nodeTypeRaw, rawFields] = line.split(":");
  const nodeType = nodeTypeRaw.trim();

  // Remove surrounding brackets and split on commas
  const fields = rawFields
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  interfaces.push(toInterface(nodeType, fields));
  typeNames.push(`IParser${nodeType}Node`);
  kindMapEntries.push(`  [ParserKind.${nodeType}]: IParser${nodeType}Node;`);
}

// 3) Build the base interface (children pulled out of index signature)
const header = `// Auto‐generated from embedded _c_ast.cfg

export interface ParserBaseASTNode {
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;

  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];

  /**
   * Anything else (literal fields, names, qualifiers, qualifiers, etc.)
   * may be a primitive or a single AST node, but never an array.
   */
  [key: string]: string | number | boolean | null | ParserASTNode | ParserASTNode[] | undefined;
}
`;

// 4) Build the ParserKind enum
const kindEnum = `export enum ParserKind {
${lines
  .map((line) => {
    const [nodeType] = line.split(":");
    return `  ${nodeType.trim()} = "${nodeType.trim()}",`;
  })
  .join("\n")}
}
`;

// 5) Build the union of all ParserASTNode variants
const union = `export type ParserASTNode =
  | ${typeNames.join("\n  | ")};
`;

// 6) Build KindToNodeMap
const kindToNodeMap = `export type KindToNodeMap = {
${kindMapEntries.join("\n")}
};
`;

// 7) Concatenate all parts and write to file
const fullOutput = [header, kindEnum, "", interfaces.join("\n"), union, kindToNodeMap].join("\n");

const outputPath = path.resolve(process.cwd(), "src/types/PyCParser/pycparser.ts");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, fullOutput);

// Optionally run ESLint fix
execSync(`eslint --fix ${outputPath}`, { stdio: "inherit" });
console.log(`Type definitions written to ${outputPath}`);
