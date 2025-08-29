import cliProgress from "cli-progress";
import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/ast/ASTExtractor";
import { KASTConverter } from "@/ast/KASTConverter";
import { PlanationTool } from "@/ast/PlanationTool";
import { PostProcessor } from "@/ast/PostProcessor";
import { validateCPGRoot } from "@/cpg/validate/zod";
import { ASTNodeTypes } from "@/types/ast/BaseNode/BaseNode";
import { CPGRoot, TreeNode } from "@/types/joern";
import { ASTGraph, ASTNodes } from "@/types/node";
import { listJsonFiles, writeJSONFiles } from "@/utils/json";
import { TreeToText } from "@/utils/treeToText";

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

// Count all files recursively under a directory
function countFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

async function processCPGFiles(chunkSize = 100, progressBar = true): Promise<void> {
  // ensure output directory exists and set up error logging
  fs.mkdirSync(outputDir, { recursive: true });
  const errorLogPath = path.join(outputDir, "error.log");
  const errorLogStream = fs.createWriteStream(errorLogPath, { flags: "a" });

  function logError(context: string) {
    const timestamp = new Date().toISOString();
    errorLogStream.write(`${timestamp} - ${context}\n`);
    console.error(context);
  }

  const allFiles = await listJsonFiles(targetDir);
  if (allFiles.length === 0) {
    logError("No JSON files found.");
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
  const treeToText = new TreeToText(["properties", "line_no", "code"]);

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

  if (progress) {
    progress.start(totalFiles, 0);
  }

  let processedCount = 0;
  let successCount = 0;

  for (const fileChunk of chunks) {
    for (const inPath of fileChunk) {
      processedCount++;
      if (progress) {
        progress.increment();
      }

      let root: CPGRoot;
      try {
        const raw = await fs.promises.readFile(inPath, "utf8");
        root = JSON.parse(raw) as CPGRoot;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const context = `Read/parse error for ${path.basename(inPath)}: ${msg}`;
        logError(context);
        if (progress) {
          progress.stop();
          progress.start(totalFiles, processedCount);
        }
        continue;
      }

      try {
        validateCPGRoot([root.export]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const context = `Validation failed for ${path.basename(inPath)}: ${msg}`;
        logError(context);
        if (progress) {
          progress.stop();
          progress.start(totalFiles, processedCount);
        }
        continue;
      }

      let ast: TreeNode[];
      let kastResult: ASTNodes[];
      try {
        ast = withContext("getAstTree", () => extractor.getAstTree(root.export));
        const converted = withContext("convertTree", () => converter.convertTree(ast));
        kastResult = withContext("removeInvalidNodes", () => postProcessor.removeInvalidNodes(converted));
        // kastResult = withContext("mergeArraySizeAllocation", () => postProcessor.mergeArraySizeAllocation(kastResult));
        kastResult = withContext("addCodeProperties", () => postProcessor.addCodeProperties(kastResult, root));
        // kastResult = withContext("isolateTranslationUnit", () => postProcessor.isolateTranslationUnit(kastResult));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const context = `Processing failed for ${path.basename(inPath)}: ${msg}`;
        logError(context);

        if (progress) {
          progress.stop();
          progress.start(totalFiles, processedCount);
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
        const context = `Write JSON error for ${path.basename(inPath)}: ${msg}`;
        logError(context);
        if (progress) {
          progress.stop();
          progress.start(totalFiles, processedCount);
        }
        continue;
      }

      try {
        const textLines = kastResult.map((rootNode) => treeToText.convert(rootNode));
        const textFile = path.join(destDir, `${parsed.name}_text.txt`);
        await fs.promises.writeFile(textFile, textLines.join("\n\n"), "utf8");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const context = `Write text error for ${path.basename(inPath)}: ${msg}`;
        logError(context);
        if (progress) {
          progress.stop();
          progress.start(totalFiles, processedCount);
        }
        continue;
      }

      const flatten = planationTool.flatten(kastResult);
      const flattenOutPath = path.join(destDir, `${parsed.name}_flatten.json`);
      try {
        writeSingleJSON(flatten, flattenOutPath);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const context = `Write flattened JSON error for ${path.basename(inPath)}: ${msg}`;
        logError(context);
        if (progress) {
          progress.stop();
          progress.start(totalFiles, processedCount);
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

  const calls = converter.getCallCollection();

  logError(`Processed ${String(processedCount)}/${String(totalFiles)} files; succeeded ${String(successCount)}`);
  logError(`Total calls collected: ${String(calls.length)}`);
  for (const call of calls) {
    logError(`  • ${call}`);
  }

  // close the error log stream
  errorLogStream.end();
}

// Verify that the number of generated files equals jsonCount * multiplier
function verifyGeneratedFiles(outputDir: string, jsonCount: number, multiplier = 4): void {
  const generatedCount = countFiles(outputDir);
  const expectedCount = jsonCount * multiplier + 1;
  if (generatedCount !== expectedCount) {
    console.error(`File count mismatch: expected ${String(expectedCount)}, but found ${String(generatedCount)}`);
    process.exit(1);
  }
  console.log(`Verified generation of ${String(generatedCount)} files.`);
}

function withContext<T>(fnName: string, fn: () => T): T {
  try {
    return fn();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // re-throw with the function name prefixed
    throw new Error(`${fnName} failed: ${msg}`);
  }
}

/**
 * Writes a single item to JSON via writeJSONFiles, returning the written path.
 * Throws on error.
 */
function writeSingleJSON(item: ASTGraph[] | ASTNodes[] | TreeNode[], outPath: string): string {
  const [written] = writeJSONFiles([item], [outPath]);
  return written;
}

void processCPGFiles()
  .then(() => {
    const jsonCount = countFiles(targetDir);
    verifyGeneratedFiles(outputDir, jsonCount);
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const context = `Fatal error in processCPGFiles: ${msg}`;
    // Assuming outputDir exists by now, attempt to log
    const logPath = path.join(outputDir, "error.log");
    try {
      fs.appendFileSync(logPath, `${new Date().toISOString()} - ${context}\n`);
    } catch (err) {
      void err;
    }
    console.error(context);
    process.exit(1);
  });
