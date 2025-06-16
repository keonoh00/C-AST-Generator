import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/joern/ast/ASTExtractor";
import { TreeGenerator } from "@/joern/ast/TreeGenerator";
import { GraphData } from "@/types/Joern";
import { listJsonFiles } from "@/utils/listJson";
import { readJSONFiles } from "@/utils/readJson";
import { writeJSONWithChunkSize } from "@/utils/writeJson";

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
  const treeGen = new TreeGenerator();

  const trees = parsedRoots.map((parsed) => {
    const ast: GraphData = extractor.extractAstEdges(parsed);
    return treeGen.generateForest(ast);
  });

  const outPaths: string[] = inputFiles.map((inPath) => {
    const rel = path.relative(targetDir, inPath);
    const parsedPath = path.parse(rel);
    const destDir = path.join(outputDir, parsedPath.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const outFilename = `${parsedPath.name}_astTree${parsedPath.ext}`;
    return path.join(destDir, outFilename);
  });

  writeJSONWithChunkSize(trees, outPaths, 3);
}

void processCPGFiles().catch((err: unknown) => {
  throw err;
});
