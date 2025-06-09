// src/parser/convert.ts
import fs from "fs";
import path from "path";

import type { ParserNode } from "@/types/pycparser";

import { convertCParserNodes } from "@/parser/converter"; // <-- import the free function
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJSONFiles, readLongJSONFiles } from "@/parser/utils/readJson";
import { writeJSONFiles, writeLongJSONFiles } from "@/parser/utils/writeJson";

const targetDir = "./ast_output";
const cacheDir = "./converted";
const cachePath = path.join(cacheDir, "cache.bin");

async function processASTFiles(): Promise<void> {
  console.log(`[debug] Starting AST processing at ${new Date().toISOString()}`);
  console.log(`[debug] Target directory: ${targetDir}`);
  console.log(`[debug] Cache path: ${cachePath}`);

  try {
    let rawNodes: ParserNode[];
    fs.mkdirSync(cacheDir, { recursive: true });

    if (fs.existsSync(cachePath)) {
      console.log("[debug] Cache file found. Attempting to load binary cache...");
      try {
        const loaded = readLongJSONFiles(cachePath);
        rawNodes = loaded as ParserNode[];
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
        rawNodes = parsed as ParserNode[];
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
      }
    }

    console.log("[debug] Converting parsed AST nodes to internal representation...");
    let converted: unknown[];
    try {
      // ► CALL THE FREE FUNCTION directly:
      converted = convertCParserNodes(rawNodes);
      console.log(`[debug] Conversion produced ${converted.length.toString()} ASTNodes.`);
    } catch (e) {
      console.error("[fatal-error] Converter threw an error:", e);
      for (let i = 0; i < rawNodes.length; i++) {
        try {
          // isolate the failing node
          convertCParserNodes([rawNodes[i]]);
        } catch (inner) {
          console.error(`[fatal-error] Conversion failed on node index ${i.toString()}:`, rawNodes[i]);
          console.error(inner);
          break;
        }
      }
      throw new Error("Aborting due to conversion failure.");
    }

    console.log("[debug] Preparing to write converted AST nodes into mirrored subpaths under converted/");
    const originalFiles = await listJsonFiles(targetDir);
    const outputPaths = originalFiles.map((inputPath) => {
      const relPath = path.relative(targetDir, inputPath);
      return path.join(cacheDir, relPath);
    });

    writeJSONFiles(converted, outputPaths);
    console.log("[debug] Successfully wrote converted JSON files.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fatal-error] ${msg}`);
    console.error("[debug] Stack trace:", (err as Error).stack);
  }

  console.log(`[debug] processASTFiles completed at ${new Date().toISOString()}`);
}

void processASTFiles();
