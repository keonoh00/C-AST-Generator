import cliProgress from "cli-progress";
import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/joern/ast/ASTExtractor";
import { KASTConverter } from "@/joern/kast/KASTConverter";
import { PostProcessor } from "@/joern/kast/PostProcessor";
import { PlanationTool } from "@/joern/planation/PlanationTool";
import { TreeToText } from "@/joern/utils/TreeToText";
import { validateCPGRoot } from "@/joern/validate/zod";
import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { CPGRoot, TreeNode } from "@/types/joern";
import { ASTGraph, ASTNodes } from "@/types/node";
import { listJsonFiles } from "@/utils/listJson";
import { writeJSONFiles } from "@/utils/writeJson";

// Read command-line arguments: first is input directory, second is output directory
const args: string[] = process.argv.slice(2);
const targetDir: string = args[0];
const outputDir: string = args[1];

if (!targetDir || !outputDir) {
  console.error("Usage: node generateAST.js <input_directory> <output_directory>");
  process.exit(1);
}

// Helper to split an array into chunks of size `size`
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function processCPGFiles(chunkSize = 100, progressBar = true): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });

  const allFiles = await listJsonFiles(targetDir);
  if (allFiles.length === 0) {
    throw new Error("No JSON files found.");
  }

  const extractor = new ASTExtractor();
  const converter = new KASTConverter();
  const postProcessor = new PostProcessor();
  const planationTool = new PlanationTool([
    ASTNodeTypes.VariableDeclaration,
    ASTNodeTypes.ArrayDeclaration,
    ASTNodeTypes.PointerDeclaration,
    ASTNodeTypes.ParameterDeclaration,
    ASTNodeTypes.AssignmentExpression,
    ASTNodeTypes.FunctionDeclaration,
    ASTNodeTypes.FunctionDefinition,
    ASTNodeTypes.StandardLibCall,
    ASTNodeTypes.UserDefinedCall,
    ASTNodeTypes.CastExpression,
    ASTNodeTypes.MemberAccess,
    ASTNodeTypes.PointerDereference,
    ASTNodeTypes.AddressOfExpression,
    ASTNodeTypes.ArraySubscriptExpression,
    ASTNodeTypes.BinaryExpression,
    ASTNodeTypes.UnaryExpression,
    ASTNodeTypes.SizeOfExpression,
    ASTNodeTypes.Identifier,
    ASTNodeTypes.Literal,
  ]);
  const treeToText = new TreeToText(["properties", "line_no"]);

  const totalFiles = allFiles.length;
  const chunks = chunkArray(allFiles, chunkSize);

  const progress = progressBar
    ? new cliProgress.SingleBar(
        {
          format: "Progress |{bar}| {percentage}% || {value}/{total}",
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic
      )
    : null;

  if (progress) progress.start(totalFiles, 0);

  let processedCount = 0;
  let successCount = 0;

  for (const fileChunk of chunks) {
    for (const inPath of fileChunk) {
      processedCount++;
      if (progress) progress.increment();

      let root: CPGRoot;
      try {
        const raw = await fs.promises.readFile(inPath, "utf8");
        root = JSON.parse(raw) as CPGRoot;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (progress) {
          progress.stop();
          console.error(`Read/parse error for ${path.basename(inPath)}: ${msg}`);
          progress.start(totalFiles, processedCount);
        } else {
          console.error(`Read/parse error for ${path.basename(inPath)}: ${msg}`);
        }
        continue;
      }

      try {
        validateCPGRoot([root.export]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (progress) {
          progress.stop();
          console.error(`Validation failed for ${path.basename(inPath)}: ${msg}`);
          progress.start(totalFiles, processedCount);
        } else {
          console.error(`Validation failed for ${path.basename(inPath)}: ${msg}`);
        }
        continue;
      }

      let ast: TreeNode[];
      let kastResult: ASTNodes[];
      try {
        ast = extractor.getAstTree(root.export);
        const converted = converter.convertTree(ast);
        kastResult = postProcessor.removeInvalidNodes(converted);
        kastResult = postProcessor.mergeArraySizeAllocation(kastResult);
        kastResult = postProcessor.addCodeProperties(kastResult, root);
        // kastResult = postProcessor.updateMemberAccessTypeLength(kastResult, root);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (progress) {
          progress.stop();
          console.error(`Processing failed for ${path.basename(inPath)}: ${msg}`);
          progress.start(totalFiles, processedCount);
        } else {
          console.error(`Processing failed for ${path.basename(inPath)}: ${msg}`);
        }
        continue;
      }

      const rel = path.relative(targetDir, inPath);
      const parsed = path.parse(rel);
      const destDir = path.join(outputDir, parsed.dir);
      fs.mkdirSync(destDir, { recursive: true });

      const astOutPath = path.join(destDir, `${parsed.name}_astTree${parsed.ext}`);
      const templateAstOutPath = path.join(destDir, `${parsed.name}_templateTree${parsed.ext}`);

      try {
        writeSingleJSON(ast, astOutPath);
        writeSingleJSON(kastResult, templateAstOutPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (progress) {
          progress.stop();
          console.error(`Write JSON error for ${path.basename(inPath)}: ${msg}`);
          progress.start(totalFiles, processedCount);
        } else {
          console.error(`Write JSON error for ${path.basename(inPath)}: ${msg}`);
        }
        continue;
      }

      try {
        const textLines = kastResult.map((rootNode) => treeToText.convert(rootNode));
        const textFile = path.join(destDir, `${parsed.name}_text.txt`);
        await fs.promises.writeFile(textFile, textLines.join("\n\n"), "utf8");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (progress) {
          progress.stop();
          console.error(`Write text error for ${path.basename(inPath)}: ${msg}`);
          progress.start(totalFiles, processedCount);
        } else {
          console.error(`Write text error for ${path.basename(inPath)}: ${msg}`);
        }
        continue;
      }

      const flatten = planationTool.flatten(kastResult);
      const flattenOutPath = path.join(destDir, `${parsed.name}_flatten.json`);
      try {
        writeSingleJSON(flatten, flattenOutPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (progress) {
          progress.stop();
          console.error(`Write flattened JSON error for ${path.basename(inPath)}: ${msg}`);
          progress.start(totalFiles, processedCount);
        } else {
          console.error(`Write flattened JSON error for ${path.basename(inPath)}: ${msg}`);
        }
        continue;
      }

      successCount++;
    }
  }

  if (progress) {
    progress.update(totalFiles);
    progress.stop();
  }

  console.log(`Processed ${String(processedCount)}/${String(totalFiles)} files; succeeded ${String(successCount)}`);
}

/**
 * Writes a single item to JSON via writeJSONFiles, returning the written path.
 * Throws on error.
 */
function writeSingleJSON(item: ASTGraph[] | ASTNodes[] | TreeNode[], outPath: string): string {
  const [written] = writeJSONFiles([item], [outPath]);
  return written;
}

void processCPGFiles().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Fatal error in processCPGFiles: ${msg}`);
  process.exit(1);
});
