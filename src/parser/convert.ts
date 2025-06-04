// src/parser/convert.ts
import path from "path";

import { CParserNodeConverter } from "@/parser/converter";
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJsonFiles } from "@/parser/utils/readJson";
import { writeJSONFiles } from "@/parser/utils/writeJson";
import { ParserASTNode } from "@/types/PyCParser/pycparser";

const targetDir = "./ast_output";

async function processASTFiles(): Promise<void> {
  try {
    const files = await listJsonFiles(targetDir);
    if (files.length === 0) {
      console.warn(`[info] No JSON files found in: ${targetDir}`);
      return;
    }

    const rawNodes = (await readJsonFiles(files)) as ParserASTNode[];

    const converter = new CParserNodeConverter();
    const converted = converter.convertCParserNodes(rawNodes);

    const dirPaths = rawNodes.map((_, i) => path.join("./converted", `ast_${String(i)}.json`));

    console.log(`[info] Converted ${String(converted.length)} AST nodes.`);

    const result = writeJSONFiles(converted, dirPaths);
    if (result instanceof Promise) {
      await result;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fatal-error]", msg);
  }
}

void processASTFiles();
