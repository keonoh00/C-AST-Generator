import fs from "fs";
import path from "path";

import type { ParserASTNode } from "@/types/PyCParser/pycparser";

import { CParserNodeConverter } from "@/parser/converter";
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJSONFiles, readLongJSONFiles } from "@/parser/utils/readJson";
import { writeJSONFiles, writeLongJSONFiles } from "@/parser/utils/writeJson";

const targetDir = "./ast_output";
const cachePath = "./cache.bin";

async function processASTFiles(): Promise<void> {
  console.log(`[debug] Starting AST processing at ${new Date().toISOString()}`);
  console.log(`[debug] Target directory: ${targetDir}`);
  console.log(`[debug] Cache path: ${cachePath}`);

  try {
    let rawNodes: ParserASTNode[];

    if (fs.existsSync(cachePath)) {
      console.log("[debug] Cache file found. Attempting to load binary cache...");
      try {
        const loaded = readLongJSONFiles(cachePath);
        rawNodes = loaded as ParserASTNode[];
        console.log(`[debug] Loaded ${rawNodes.length.toString()} nodes from cache.`);
      } catch (e) {
        console.error(`[fatal-error] Failed to load cache at ${cachePath}:`, e);
        throw new Error("Aborting due to cache load failure.");
      }
    } else {
      console.log("[debug] No cache found. Scanning JSON files in target directory...");
      const files = await listJsonFiles(targetDir);
      console.log(`[debug] Found ${files.length.toString()} JSON file(s).`);
      if (files.length === 0) {
        console.warn(`[info] No JSON files found in: ${targetDir}`);
        return;
      }

      console.log("[debug] Reading and parsing JSON files one by one:");
      try {
        const parsed = await readJSONFiles(files);
        console.log(`[debug] Successfully parsed ${parsed.length.toString()} JSON objects.`);
        rawNodes = parsed as ParserASTNode[];
      } catch (e) {
        console.error("[fatal-error] Error while reading JSON files:", e);
        throw new Error("Aborting due to JSON read failure.");
      }

      console.log("[debug] Caching raw nodes into binary file...");
      try {
        writeLongJSONFiles(rawNodes, cachePath);
        console.log(`[debug] Cached ${rawNodes.length.toString()} nodes to ${cachePath}`);
      } catch (e) {
        console.error(`[fatal-error] Failed to write cache at ${cachePath}:`, e);
        // Not aborting here; we can still proceed without cache.
      }
    }

    console.log("[debug] Converting parsed AST nodes to internal representation...");
    const converter = new CParserNodeConverter();
    let converted: unknown[];
    try {
      converted = converter.convertCParserNodes(rawNodes);
      console.log(`[debug] Conversion produced ${converted.length.toString()} ASTNodes.`);
    } catch (e) {
      console.error("[fatal-error] Converter threw an error:", e);
      // Attempt to pinpoint which node caused the error
      for (let i = 0; i < rawNodes.length; i++) {
        try {
          converter.convertCParserNodes([rawNodes[i]]);
        } catch (inner) {
          console.error(`[fatal-error] Conversion failed on node index ${i.toString()}:`, rawNodes[i]);
          console.error(inner);
          break;
        }
      }
      throw new Error("Aborting due to conversion failure.");
    }

    console.log("[debug] Preparing output file paths for converted ASTs...");
    const dirPaths = converted.map((_, i) => path.join("./converted", `ast_${i.toString()}.json`));
    console.log(`[debug] Prepared ${dirPaths.length.toString()} output paths.`);

    console.log("[debug] Writing converted AST nodes to JSON files...");
    try {
      writeJSONFiles(converted, dirPaths);
      console.log("[debug] Successfully wrote converted JSON files.");
    } catch (e) {
      console.error("[fatal-error] Failed to write converted JSON files:", e);
      throw new Error("Aborting due to write failure.");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fatal-error] ${msg}`);
    console.error("[debug] Stack trace:", (err as Error).stack);
  }

  console.log(`[debug] processASTFiles completed at ${new Date().toISOString()}`);
}

void processASTFiles();
