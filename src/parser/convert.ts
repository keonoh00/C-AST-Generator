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
  try {
    let rawNodes: ParserASTNode[];

    if (fs.existsSync(cachePath)) {
      // Read back the single binary file, then cast to ParserASTNode[]
      rawNodes = readLongJSONFiles(cachePath) as ParserASTNode[];
    } else {
      const files = await listJsonFiles(targetDir);
      if (files.length === 0) {
        console.warn(`[info] No JSON files found in: ${targetDir}`);
        return;
      }

      // Read all JSON files (returns unknown[]), then cast
      rawNodes = (await readJSONFiles(files)) as ParserASTNode[];

      // Cache the entire array into one binary file
      writeLongJSONFiles(rawNodes, cachePath);
    }

    const converter = new CParserNodeConverter();
    const converted = converter.convertCParserNodes(rawNodes);

    // Prepare output JSON filenames
    const dirPaths = rawNodes.map((_, i) => path.join("./converted", `ast_${String(i)}.json`));

    console.log(`[info] Converted ${String(converted.length)} AST nodes.`);

    // Write each converted AST node as JSON
    writeJSONFiles(converted, dirPaths);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fatal-error]", msg);
  }
}

void processASTFiles();
