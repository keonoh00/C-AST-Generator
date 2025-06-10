import { Presets, SingleBar } from "cli-progress";
import fs from "fs";
import path from "path";

import type { ParserNode } from "@/types/pycparser";

import { CParserNodeConverter } from "@/parser/converter";
import { ASTFilter } from "@/parser/filter";
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJSONFiles, readLongJSONFiles } from "@/parser/utils/readJson";
import { writeJSONFiles, writeJSONWithChunkSize, writeLongJSONFiles } from "@/parser/utils/writeJson";
import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ASTNodes } from "@/types/node";

const targetDir = "./ast_output";
const cacheDir = "./converted";
const cachePath = path.join(cacheDir, "cache.bin");

function convertParserToTemplate(nodes: ASTNodes[]): ASTNodes[] {
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
  const BLACKLIST = Object.values(ASTNodeTypes).filter((val) => !WHITELIST.includes(val));
  const filter = new ASTFilter(BLACKLIST);
  return filter.filterNodes(nodes);
}

async function loadRawNodes(): Promise<ParserNode[]> {
  if (fs.existsSync(cachePath)) {
    console.log("[debug] Loading nodes from cache...");
    try {
      const data = readLongJSONFiles(cachePath) as ParserNode[];
      console.log(`[debug] Loaded ${data.length.toString()} nodes from cache.`);
      return data;
    } catch (error) {
      console.error(`[fatal-error] Cache load failed:`, error);
      throw error;
    }
  }

  console.log("[debug] No cache found, scanning JSON files...");
  const files = await listJsonFiles(targetDir);
  console.log(`[debug] Found ${files.length.toString()} JSON file(s).`);
  if (!files.length) {
    console.warn(`[info] No JSON files in ${targetDir}`);
    return [];
  }

  console.log("[debug] Reading JSON files...");
  const nodes = (await readJSONFiles(files)) as ParserNode[];
  console.log(`[debug] Parsed ${nodes.length.toString()} JSON objects.`);

  try {
    writeLongJSONFiles(nodes, cachePath);
    console.log(`[debug] Cached ${nodes.length.toString()} nodes to cache.`);
  } catch (error) {
    console.error(`[warn] Failed to write cache:`, error);
  }

  return nodes;
}

async function processASTFiles(): Promise<void> {
  console.log(`[debug] Starting AST processing at ${new Date().toISOString()}`);
  fs.mkdirSync(cacheDir, { recursive: true });

  const converter = new CParserNodeConverter();

  let rawNodes;
  const bar = new SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: "Converting AST to K-SIGN Template |{bar}| {percentage}% || {value}/{total} files",
      hideCursor: true,
    },
    Presets.shades_classic
  );

  try {
    rawNodes = await loadRawNodes();
    if (!rawNodes.length) return;
    console.log("[debug] Converting AST nodes...");

    bar.start(rawNodes.length, 0);

    const converted = [];

    for (let i = 0; i < rawNodes.length; i++) {
      const rawNode = rawNodes[i];
      converted.push(converter.convertCParserNodes([rawNode])[0]);
      bar.increment();
      rawNodes[i] = {} as ParserNode;
    }
    bar.stop();

    console.log(`[debug] Conversion produced ${converted.length.toString()} nodes.`);

    const filtered = convertParserToTemplate(converted);

    // build the list of input files
    const inputFiles = await listJsonFiles(targetDir);

    // map each input → its converted output path
    const convertedPaths = inputFiles.map((input) => {
      const rel = path.relative(targetDir, input);
      const parsed = path.parse(path.join(cacheDir, rel));
      return path.join(parsed.dir, `${parsed.name}_converted${parsed.ext}`);
    });

    // map each input → its filtered output path
    const filteredPaths = inputFiles.map((input) => {
      const rel = path.relative(targetDir, input);
      const parsed = path.parse(path.join(cacheDir, rel));
      return path.join(parsed.dir, `${parsed.name}_filtered${parsed.ext}`);
    });

    // write both arrays in parallel, using your shared utility
    writeJSONWithChunkSize(converted, convertedPaths, 3);
    writeJSONWithChunkSize(filtered, filteredPaths, 3);
  } catch (error) {
    bar.stop();
    console.error("[fatal-error] Processing failed:", error);
  } finally {
    console.log(`[debug] processASTFiles completed at ${new Date().toISOString()}`);
    writeJSONFiles([converter.getConversionCounts()], ["counts.json"]);
  }
}

void processASTFiles();
