// src/parser/server.ts

import { Presets, SingleBar } from "cli-progress";
import fs from "fs";
import path from "path";

import type { ParserNode } from "@/types/pycparser";

import { CParserNodeConverter } from "@/parser/converter";
import { ASTGraphFilter } from "@/parser/filter/GraphFilter";
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJSONFiles } from "@/parser/utils/readJson";
import { writeJSONFiles, writeJSONWithChunkSize } from "@/parser/utils/writeJson";
import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ASTNodes } from "@/types/node";

import { ASTGraph, ASTNodesSeparator } from "./separator";
import { validateGraphs } from "./validator/functions";

const targetDir = "./ast_output";
const cacheDir = "./converted";

// your whitelist of nodeTypes to *keep*
const WHITELIST = [
  ASTNodeTypes.VariableDeclaration,
  ASTNodeTypes.ArrayDeclaration,
  ASTNodeTypes.PointerDeclaration,
  ASTNodeTypes.ParameterDeclaration,
  ASTNodeTypes.AssignmentExpression,
  ASTNodeTypes.FunctionDefinition,
  ASTNodeTypes.StandardLibCall,
  ASTNodeTypes.UserDefinedCall,
  ASTNodeTypes.CastExpression,
  ASTNodeTypes.MemberAccess,
  ASTNodeTypes.PointerDereference,
  ASTNodeTypes.AddressOfExpression,
  ASTNodeTypes.ArraySubscriptionExpression,
  ASTNodeTypes.BinaryExpression,
  ASTNodeTypes.UnaryExpression,
  ASTNodeTypes.SizeOfExpression,
  ASTNodeTypes.Identifier,
  ASTNodeTypes.Literal,
  ASTNodeTypes.ReturnStatement,
];
// everything else is blacklisted
const BLACKLIST = Object.values(ASTNodeTypes).filter((t) => !WHITELIST.includes(t));

function buildPathSaveJSONWithChunkAndSuffix(originalFileNames: string[], jsonObjects: unknown[], suffix: string) {
  const out = originalFileNames.map((input) => {
    const rel = path.relative(targetDir, input);
    const parsed = path.parse(path.join(cacheDir, rel));
    return path.join(parsed.dir, `${parsed.name}_${suffix}${parsed.ext}`);
  });
  writeJSONWithChunkSize(jsonObjects, out, 3);
}

async function loadRawNodes(): Promise<ParserNode[]> {
  console.log("[debug] No cache, reading JSON files...");
  const files = await listJsonFiles(targetDir);
  if (!files.length) return [];
  const nodes = (await readJSONFiles(files)) as ParserNode[];
  console.log(`[debug] Cached ${nodes.length.toString()} nodes.`);
  return nodes;
}

async function processASTFiles(): Promise<void> {
  console.log(`[debug] Starting at ${new Date().toISOString()}`);
  fs.mkdirSync(cacheDir, { recursive: true });

  const rawNodes = await loadRawNodes();
  if (!rawNodes.length) return;

  const converter = new CParserNodeConverter();
  const bar = new SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: "Converting AST to K-SIGN Template |{bar}| {percentage}% || {value}/{total} files",
      hideCursor: true,
    },
    Presets.shades_classic
  );
  console.log("[debug] Converting AST nodes...");
  bar.start(rawNodes.length, 0);
  const converted: ASTNodes[] = rawNodes.map((n) => {
    const ast = converter.convertCParserNodes([n])[0];
    bar.increment();
    return ast;
  });
  bar.stop();
  console.log(`[debug] Converted ${converted.length.toString()} AST roots`);

  // separate into flat graphs
  const separator = new ASTNodesSeparator();
  const convertGraphs: ASTGraph[] = separator.build(converted);

  // now filter *graphs*
  const graphFilter = new ASTGraphFilter(BLACKLIST);
  const filterGraphs: ASTGraph[] = graphFilter.filter(convertGraphs);

  // validate
  const inputFiles = await listJsonFiles(targetDir);
  validateGraphs(convertGraphs, filterGraphs, WHITELIST, BLACKLIST);

  // write out
  buildPathSaveJSONWithChunkAndSuffix(inputFiles, convertGraphs, "convertFlat");
  convertGraphs.fill({} as ASTGraph);
  buildPathSaveJSONWithChunkAndSuffix(inputFiles, filterGraphs, "filterFlat");

  // finally persist conversion counts
  writeJSONFiles([converter.getConversionCounts()], ["counts.json"]);

  console.log(`[debug] Completed at ${new Date().toISOString()}`);
}

void processASTFiles();
