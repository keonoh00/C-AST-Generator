import cliProgress from "cli-progress";
import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/joern/ast/ASTExtractor";
import { RootGraphSON, TreeNode } from "@/types/joern";
import { ASTNodes } from "@/types/node";
import { listJsonFiles } from "@/utils/listJson";
import { writeJSONFiles } from "@/utils/writeJson";

import { KASTConverter } from "./kast/KASTConverter";
import { PostProcessor } from "./kast/PostProcessor";
import { TreeToText } from "./utils/TreeToText";
import { validateRootGraphSON } from "./validate/zod";

// Helper to split an array into chunks of size `size`
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processCPGFiles(chunkSize = 100): Promise<void> {
  const targetDir = "./test";
  const outputDir = "./joern";
  fs.mkdirSync(outputDir, { recursive: true });

  const allFiles = await listJsonFiles(targetDir);
  if (allFiles.length === 0) {
    throw new Error("No JSON files found.");
  }

  const extractor = new ASTExtractor();
  const converter = new KASTConverter();
  const postProcessor = new PostProcessor();
  const treeToText = new TreeToText(["id", "properties", "line_no", "code"]);

  const totalFiles = allFiles.length;
  const chunks = chunkArray(allFiles, chunkSize);

  // Create and start a single progress bar for total files
  const progressBar = new cliProgress.SingleBar(
    {
      format: "Progress |{bar}| {percentage}% || {value}/{total}",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(totalFiles, 0);

  let processedCount = 0;
  let successCount = 0;

  // Process files in chunks to limit memory footprint
  for (const fileChunk of chunks) {
    for (const inPath of fileChunk) {
      // Always increment at the start of handling this file
      processedCount++;
      progressBar.increment(); // move bar by 1 for this file  [oai_citation:0‡npmjs.com](https://www.npmjs.com/package/cli-progress?utm_source=chatgpt.com) [oai_citation:1‡npmjs.com](https://www.npmjs.com/package/cli-progress/v/3.8.0?utm_source=chatgpt.com)

      // 1) Read & parse
      let rootExport: RootGraphSON;
      try {
        const raw = await fs.promises.readFile(inPath, "utf8");
        const json = JSON.parse(raw) as { export: RootGraphSON };
        rootExport = json.export;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Stop bar to log error cleanly, then restart at processedCount
        progressBar.stop();
        console.error(`Read/parse error for ${path.basename(inPath)}: ${msg}`);
        progressBar.start(totalFiles, processedCount);
        continue;
      }

      // 2) Validate
      try {
        validateRootGraphSON([rootExport]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        progressBar.stop();
        console.error(`Validation failed for ${path.basename(inPath)}: ${msg}`);
        progressBar.start(totalFiles, processedCount);
        continue;
      }

      // 3) Extract, convert, post-process
      let ast: TreeNode[];
      let kastResult: ASTNodes[];
      try {
        ast = extractor.getAstTree(rootExport);
        const converted = converter.convertTree(ast);
        kastResult = postProcessor.removeInvalidNodes(converted);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        progressBar.stop();
        console.error(`Processing failed for ${path.basename(inPath)}: ${msg}`);
        progressBar.start(totalFiles, processedCount);
        continue;
      }

      // 4) Prepare output path
      const rel = path.relative(targetDir, inPath);
      const parsed = path.parse(rel);
      const destDir = path.join(outputDir, parsed.dir);
      fs.mkdirSync(destDir, { recursive: true });
      const astOutPath = path.join(destDir, `${parsed.name}_astTree${parsed.ext}`);
      const templateAstOutPath = path.join(destDir, `${parsed.name}_templateTree${parsed.ext}`);

      // 5) Write JSON via writeJSONFiles
      try {
        writeSingleJSON(ast, astOutPath);
        writeSingleJSON(kastResult, templateAstOutPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        progressBar.stop();
        console.error(`Write JSON error for ${path.basename(inPath)}: ${msg}`);
        progressBar.start(totalFiles, processedCount);
        continue;
      }

      // 6) Write text output
      try {
        const textLines = kastResult.map((rootNode) => treeToText.convert(rootNode));
        const textFile = path.join(destDir, `${parsed.name}_text.txt`);
        await fs.promises.writeFile(textFile, textLines.join("\n\n"), "utf8");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        progressBar.stop();
        console.error(`Write text error for ${path.basename(inPath)}: ${msg}`);
        progressBar.start(totalFiles, processedCount);
        continue;
      }

      // If reached here, file succeeded
      successCount++;
      // No further increment needed; bar already moved above
    }
    // After each chunk, nothing special needed; loop continues
  }

  // Finish progress bar
  progressBar.update(totalFiles);
  progressBar.stop();

  // Final summary
  console.log(`Processed ${String(processedCount)}/${String(totalFiles)} files; succeeded ${String(successCount)}`);
}

/**
 * Writes a single item to JSON via writeJSONFiles, returning the written path.
 * Throws on error.
 */
function writeSingleJSON(item: ASTNodes[] | TreeNode[], outPath: string): string {
  const [written] = writeJSONFiles([item], [outPath]);
  return written;
}

void processCPGFiles().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Fatal error in processCPGFiles: ${msg}`);
  process.exit(1);
});
