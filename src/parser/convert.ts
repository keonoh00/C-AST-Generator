import fs from "fs";
import path from "path";

import type { ParserNode } from "@/types/pycparser";

import { convertCParserNodes } from "@/parser/converter";
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJSONFiles, readLongJSONFiles } from "@/parser/utils/readJson";
import { writeJSONFiles, writeLongJSONFiles } from "@/parser/utils/writeJson";

const targetDir = "./ast_output";
const cacheDir = "./converted";
const cachePath = path.join(cacheDir, "cache.bin");

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

  let rawNodes;

  try {
    rawNodes = await loadRawNodes();
    if (!rawNodes.length) return;

    console.log("[debug] Converting AST nodes...");
    const converted = convertCParserNodes(rawNodes);
    rawNodes = [];
    console.log(`[debug] Conversion produced ${converted.length.toString()} nodes.`);

    await writeConverted(converted);
  } catch (error) {
    console.error("[fatal-error] Processing failed:", error);
  } finally {
    console.log(`[debug] processASTFiles completed at ${new Date().toISOString()}`);
  }
}

async function writeConverted(nodes: unknown[]): Promise<void> {
  const files = await listJsonFiles(targetDir);
  const outputPaths = files.map((input) => {
    const rel = path.relative(targetDir, input);
    return path.join(cacheDir, rel);
  });

  writeJSONFiles(nodes, outputPaths);
  console.log("[debug] Converted files written successfully.");
}

void processASTFiles();
