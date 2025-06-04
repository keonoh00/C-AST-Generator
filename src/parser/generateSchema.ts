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

function parseField(field: string): ParsedField {
  let name = field;
  let type: string;
  let comment = "";
  let optional = false;

  if (field.endsWith("**")) {
    name = field.slice(0, -2);
    type = "ParserASTNode[]";
    comment = "List of child AST nodes";
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

function toInterface(nodeType: string, fields: string[]): string {
  const parsedFields = fields.map(parseField);

  const doc = `/** AST node for \`${nodeType}\` */`;
  const kindField = `  kind: ParserKind.${nodeType};`;

  const members = parsedFields
    .map((f) => {
      const docLine = `  /** ${f.comment} */`;
      const declLine = `  ${f.name}${f.optional ? "?" : ""}: ${f.type};`;
      return `${docLine}\n${declLine}`;
    })
    .concat([`  /** All nested child nodes */`, `  children?: ParserASTNode;`, `  coord: string;`])
    .join("\n");

  return `${doc}\nexport interface IParser${nodeType}Node extends ParserBaseASTNode {\n${kindField}\n${members}\n}\n`;
}

// Parse config lines
const lines = pycparserCfg
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const interfaces: string[] = [];
const typeNames: string[] = [];

// Generate interface definitions
for (const line of lines) {
  const [nodeType, rawFields] = line.split(":");
  const fields = rawFields
    .replace("[", "")
    .replace("]", "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  interfaces.push(toInterface(nodeType.trim(), fields));
  typeNames.push(`IParser${nodeType.trim()}Node`);
}

// Base interface and kind enum
const header = `// Auto-generated from embedded _c_ast.cfg

export interface ParserBaseASTNode {
  coord?: string;
  [key: string]: string | number | boolean | null | undefined | ParserASTNode | ParserASTNode[];
}
`;

const kindEnum = `export enum ParserKind {
${lines
  .map((line) => {
    const [nodeType] = line.split(":");
    return `  ${nodeType.trim()} = "${nodeType.trim()}",`;
  })
  .join("\n")}
}
`;

const union = `export type ParserASTNode =\n  | ${typeNames.join("\n  | ")};\n`;

// Write to file
const outputPath = path.resolve(process.cwd(), "src/types/PyCParser/pycparser.ts");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, header + "\n" + kindEnum + "\n\n" + interfaces.join("\n") + "\n" + union);

execSync(`eslint --fix ${outputPath}`, { stdio: "inherit" });

console.log(`Type definitions written to ${outputPath}`);
