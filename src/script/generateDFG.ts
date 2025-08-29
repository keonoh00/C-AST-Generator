import fs from "fs";
import path from "path";

import { CPGFilter } from "@/cpg/CPGFilter";
import { validateCPGRoot } from "@/cpg/validate/zod";
import { DFGBuilder } from "@/dfg/DFGBuilder";
import { CPGRoot } from "@/types/cpg";
import { writeJSONFiles } from "@/utils/json";

// Usage: node generateDFG.js <input_json> [output_path_or_dir]
const args: string[] = process.argv.slice(2);
const firstArg: string | undefined = args[0];
const secondArg: string | undefined = args[1];
// If the second arg ends with .json, treat it as an exact output file path, otherwise as a directory
const isExactJsonPath = typeof secondArg === "string" && secondArg.toLowerCase().endsWith(".json");
const savePath: string = isExactJsonPath ? path.dirname(secondArg) : secondArg ? secondArg : firstArg ? path.dirname(firstArg) : "";

if (!firstArg) {
  console.error("Usage: node generateDFG.js <input_json> [output_dir]");
  process.exit(1);
}

async function main(inputFile: string): Promise<void> {
  // Ensure output directory exists
  fs.mkdirSync(savePath, { recursive: true });

  // Read and parse single CPG JSON
  let root: CPGRoot;
  try {
    const raw = await fs.promises.readFile(inputFile, "utf8");
    root = JSON.parse(raw) as CPGRoot;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Read/parse error for ${path.basename(inputFile)}: ${msg}`);
  }

  // Verify GraphSON structure
  try {
    validateCPGRoot([root.export]);
    console.log(`Verified CPG GraphSON: ${path.basename(inputFile)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Validation failed for ${path.basename(inputFile)}: ${msg}`);
  }

  const filter = new CPGFilter(root);
  const dfgBuilder = new DFGBuilder();
  const rawDFG = dfgBuilder.build(filter.filterDFG());

  // Build output path following generateAST style
  const parsed = path.parse(inputFile);
  const outPath = isExactJsonPath ? secondArg : path.join(savePath, `${parsed.name}_dfg${parsed.ext}`);

  // Write JSON outputs
  writeSingleJSON(rawDFG, outPath);

  // Simple verification statement
  console.log(`Generated: ${path.basename(outPath)}`);
}

function writeSingleJSON(item: unknown, outPath: string): string {
  const [written] = writeJSONFiles([item], [outPath]);
  return written;
}

void (async () => {
  // after the early-exit guard, firstArg is defined
  await main(firstArg);
})().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
