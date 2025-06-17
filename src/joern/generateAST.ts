import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/joern/ast/ASTExtractor";
import { RootGraphSON } from "@/types/joern";
import { listJsonFiles } from "@/utils/listJson";
import { readJSONFiles } from "@/utils/readJson";
import { writeJSONWithChunkSize } from "@/utils/writeJson";

import { validateRootGraphSON } from "./validate/zod";

async function processCPGFiles(): Promise<void> {
  const targetDir = "./out";
  const outputDir = "./joern/ast";
  fs.mkdirSync(outputDir, { recursive: true });

  const inputFiles = await listJsonFiles(targetDir);
  if (inputFiles.length === 0) {
    throw new Error("No JSON files found.");
  }

  const parsedRoots = await readJSONFiles(inputFiles);

  const extractor = new ASTExtractor();
  validateRootGraphSON(parsedRoots as unknown);

  const asts = extractor.extractMultiple(parsedRoots as RootGraphSON[]);

  const outPaths: string[] = inputFiles.map((inPath) => {
    const rel = path.relative(targetDir, inPath);
    const parsedPath = path.parse(rel);
    const destDir = path.join(outputDir, parsedPath.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const outFilename = `${parsedPath.name}_astTree${parsedPath.ext}`;
    return path.join(destDir, outFilename);
  });

  writeJSONWithChunkSize(asts, outPaths, 3);
}

void processCPGFiles().catch((err: unknown) => {
  throw err;
});
