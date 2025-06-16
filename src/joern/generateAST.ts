import fs from "fs";
import path from "path";

import { ASTExtractor } from "@/joern/ast/ASTExtractor";
import { GraphData } from "@/types/Joern";
import { listJsonFiles } from "@/utils/listJson";
import { readJSONFiles } from "@/utils/readJson";
import { writeJSONWithChunkSize } from "@/utils/writeJson";

async function processCPGFiles(): Promise<void> {
  const targetDir = "./out";
  const outputDir = "./joern/ast";
  fs.mkdirSync(outputDir, { recursive: true });

  let inputFiles: string[];
  try {
    inputFiles = await listJsonFiles(targetDir);
  } catch (err) {
    console.error("Error listing JSON files:", err);
    return;
  }

  if (inputFiles.length === 0) {
    console.log("No JSON files found; exiting.");
    return;
  }

  console.log("Found " + String(inputFiles.length) + " JSON files under " + targetDir);

  let parsedRoots: unknown[];
  try {
    parsedRoots = await readJSONFiles(inputFiles);
  } catch (err) {
    console.error("Failed to read JSON files:", err);
    return;
  }

  console.log("Loaded " + String(parsedRoots.length) + " parsed JSON roots.");

  const extractor = new ASTExtractor();

  const results: GraphData[] = parsedRoots.map((parsed, idx) => {
    try {
      return extractor.extractAstEdges(parsed);
    } catch {
      console.warn("Invalid shape, skipping AST for: " + inputFiles[idx]);
      return { edges: [], vertices: [] };
    }
  });

  results.forEach((graph, idx) => {
    const inPath = inputFiles[idx];
    if (graph.edges.length === 0) {
      console.warn("Empty AST subgraph for: " + inPath);
    } else {
      console.log("AST for " + inPath + ": vertices=" + String(graph.vertices.length) + ", edges=" + String(graph.edges.length));
    }
  });

  const outPaths: string[] = inputFiles.map((inPath) => {
    const rel = path.relative(targetDir, inPath);
    const parsedPath = path.parse(rel);
    const destDir = path.join(outputDir, parsedPath.dir);
    fs.mkdirSync(destDir, { recursive: true });
    const outFilename = parsedPath.name + "_astOnly" + parsedPath.ext;
    return path.join(destDir, outFilename);
  });

  try {
    writeJSONWithChunkSize(results, outPaths, 3);
    console.log("Wrote " + String(results.length) + " AST-only JSON files under " + outputDir);
  } catch (err) {
    console.error("Failed to write AST-only JSON files:", err);
  }
}

processCPGFiles()
  .then(() => {
    console.log("AST extraction complete.");
  })
  .catch((err: unknown) => {
    console.error("Error during AST extraction:", err);
  });
