import { Presets, SingleBar } from "cli-progress";
import fs from "fs";
import path from "path";

import type { ParserNode } from "@/types/pycparser";

import { CParserNodeConverter } from "@/parser/converter";
import { listJsonFiles } from "@/parser/utils/listJson";
import { readJSONFiles, readLongJSONFiles } from "@/parser/utils/readJson";
import { writeJSONFiles, writeLongJSONFiles } from "@/parser/utils/writeJson";

const targetDir = "./ast_output";
const cacheDir = "./converted";
const cachePath = path.join(cacheDir, "cache.bin");

async function loadRawNodes(): Promise<ParserNode[]> {
  if (fs.existsSync(cachePath)) {
    console.log("[debug] Loading nodes from cache...");
    try {
      const data = readLongJSONFiles(cachePath) as ParserNode[];
      console.log(`[debug] Loaded ${data.length.toString()} nodes from cache.`);
      return data;
    } catch (error) {
      console.error(`[fatal-error] Cache load failed:`, error);
      throw error;
    }
  }

  console.log("[debug] No cache found, scanning JSON files...");
  const files = await listJsonFiles(targetDir);
  console.log(`[debug] Found ${files.length.toString()} JSON file(s).`);
  if (!files.length) {
    console.warn(`[info] No JSON files in ${targetDir}`);
    return [];
  }

  console.log("[debug] Reading JSON files...");
  const nodes = (await readJSONFiles(files)) as ParserNode[];
  console.log(`[debug] Parsed ${nodes.length.toString()} JSON objects.`);

  try {
    writeLongJSONFiles(nodes, cachePath);
    console.log(`[debug] Cached ${nodes.length.toString()} nodes to cache.`);
  } catch (error) {
    console.error(`[warn] Failed to write cache:`, error);
  }

  return nodes;
}

async function processASTFiles(): Promise<void> {
  console.log(`[debug] Starting AST processing at ${new Date().toISOString()}`);
  fs.mkdirSync(cacheDir, { recursive: true });

  const converter = new CParserNodeConverter();

  let rawNodes;

  try {
    rawNodes = await loadRawNodes();
    if (!rawNodes.length) return;
    console.log("[debug] Converting AST nodes...");

    const bar = new SingleBar(
      {
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        format: "Converting AST to K-SIGN Template |{bar}| {percentage}% || {value}/{total} files",
        hideCursor: true,
      },
      Presets.shades_classic
    );

    bar.start(rawNodes.length, 0);

    const converted = [];

    for (let i = 1; i < rawNodes.length; i++) {
      const rawNode = rawNodes[i];
      converted.push(converter.convertCParserNodes([rawNode])[0]);
      bar.increment();
      rawNodes[i] = {} as ParserNode;
    }
    bar.stop();

    console.log(`[debug] Conversion produced ${converted.length.toString()} nodes.`);

    await writeConvertedWithChunkSize(converted, 3);
  } catch (error) {
    console.error("[fatal-error] Processing failed:", error);
  } finally {
    console.log(`[debug] processASTFiles completed at ${new Date().toISOString()}`);
    writeJSONFiles([converter.getConversionCounts()], ["counts.json"]);
  }
}

async function writeConvertedWithChunkSize(nodes: unknown[], chunkSize: number): Promise<void> {
  const inputFiles = await listJsonFiles(targetDir);
  const outputPaths = inputFiles.map((input) => {
    const rel = path.relative(targetDir, input);
    return path.join(cacheDir, rel);
  });

  const total = nodes.length;
  const bar = new SingleBar(
    {
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      format: "Writing Converted Chunks |{bar}| {percentage}% || {value}/{total} nodes",
      hideCursor: true,
    },
    Presets.shades_classic
  );

  bar.start(total, 0);

  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total);
    const chunkNodes = nodes.slice(start, end);
    const chunkPaths = outputPaths.slice(start, end);

    // Ensure directories exist
    chunkPaths.forEach((p) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
    });

    try {
      writeJSONFiles(chunkNodes, chunkPaths);
      bar.increment(chunkNodes.length);
    } catch {
      bar.increment(chunkNodes.length);
    }
  }

  bar.stop();
  console.log("[debug] All chunks written successfully.");
}

void processASTFiles();
