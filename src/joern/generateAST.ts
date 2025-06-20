import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/joern/ast/ASTExtractor";
import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { RootGraphSON } from "@/types/joern";
import { listJsonFiles } from "@/utils/listJson";
import { readJSONFiles } from "@/utils/readJson";
import { writeJSONWithChunkSize } from "@/utils/writeJson";

import { KASTConverter } from "./kast/KASTConverter";
import { PostProcessor } from "./kast/PostProcessor";
import { TreeToText } from "./utils/TreeToText";
import { validateRootGraphSON } from "./validate/zod";

async function processCPGFiles(): Promise<void> {
  const targetDir = "./converted";
  const outputDir = "./joern";
  fs.mkdirSync(outputDir, { recursive: true });

  const inputFiles = await listJsonFiles(targetDir);
  if (inputFiles.length === 0) {
    throw new Error("No JSON files found.");
  }

  const parsedRoots = (await readJSONFiles(inputFiles)).map((root) => (root as { export: RootGraphSON }).export);

  const extractor = new ASTExtractor();
  const converter = new KASTConverter();
  const postProcessor = new PostProcessor();

  validateRootGraphSON(parsedRoots);

  const asts = parsedRoots.map((root) => extractor.getAstTree(root));
  const converted = asts.map((ast) => converter.convertTree(ast));
  const kasts = converted.map((kast) => postProcessor.process(kast));

  // Prepare JSON output paths
  const outPaths: string[] = inputFiles.map((inPath) => {
    const rel = path.relative(targetDir, inPath);
    const parsedPath = path.parse(rel);
    const destDir = path.join(outputDir, parsedPath.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const outFilename = `${parsedPath.name}_astTree${parsedPath.ext}`;
    return path.join(destDir, outFilename);
  });

  writeJSONWithChunkSize(kasts, outPaths, 3);

  const treeToText = new TreeToText(["id", "properties", "line_no", "code"]);
  const kastsInText: string[][] = kasts.map((kastRoots) => kastRoots.map((root) => treeToText.convert(root)));

  const textOutPaths: string[] = outPaths.map((outPath) => {
    const parsedPath = path.parse(outPath);
    const textFilename = `${parsedPath.name}_text.txt`;
    return path.join(parsedPath.dir, textFilename);
  });

  await Promise.all(
    kastsInText.map(async (rootTexts, idx) => {
      const outFilePath = textOutPaths[idx];
      fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
      const content = rootTexts.join("\n\n");
      await fs.promises.writeFile(outFilePath, content, "utf8");
    })
  );
}

void processCPGFiles().catch((err: unknown) => {
  throw err;
});
