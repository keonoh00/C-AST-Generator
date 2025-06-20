// src/parser/server.ts
import express, { Request, Response } from "express";
import path from "path";

import { ASTNodes } from "@/types/node";

import { ASTGraph, ASTNodesSeparator } from "./separator";
import { listJsonFiles } from "../utils/listJson";
import { readJSONFiles } from "../utils/readJson";

async function main(): Promise<void> {
  const app = express();
  const projectRoot = process.cwd();
  const GRAPH_DIR = path.join(projectRoot, "converted");
  const PUBLIC_DIR = path.join(projectRoot, "public");

  // Determine port
  const PORT_NUM = process.env.PORT ? Number(process.env.PORT) : 3000;
  const PORT_STR = PORT_NUM.toString();

  // 1️⃣ Group JSON files by base .c filename
  const paths: string[] = await listJsonFiles(GRAPH_DIR);
  const groupMap = new Map<string, string[]>();
  const regex = /^(.*?\.c)(?:_convertFlat|_convert|_filterFlat|_filter)\.json$/;
  for (const fp of paths) {
    const file = path.basename(fp);
    const match = regex.exec(file);
    if (match) {
      const base = match[1];
      const arr = groupMap.get(base) ?? [];
      arr.push(fp);
      groupMap.set(base, arr);
    }
  }

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // Serve UI
  app.get("/", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  // 2️⃣ Search base filenames
  app.get("/api/search", (req: Request, res: Response<{ files: string[] }>) => {
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const files = Array.from(groupMap.keys()).filter((base) => base.toLowerCase().includes(q));
    res.json({ files });
  });

  // 3️⃣ Serve all 4 graph variants for a base
  app.get("/api/graphs/:base", async (req: Request<{ base: string }>, res: Response<Record<string, ASTGraph> | { error: string }>) => {
    const base = req.params.base;
    const variants = groupMap.get(base);
    if (!variants) {
      res.status(404).json({ error: "Base not found" });
      return;
    }

    const suffixes = [
      ["convertFlat", "_convertFlat.json"],
      ["filterFlat", "_filterFlat.json"],
    ] as const;

    const result: Record<string, ASTGraph> = {};
    for (const [key, suffix] of suffixes) {
      const fullPath = variants.find((p) => p.endsWith(base + suffix));
      if (!fullPath) {
        res.status(500).json({ error: `Missing ${suffix}` });
        return;
      }
      try {
        const [raw] = await readJSONFiles([fullPath]);
        let graph: ASTGraph;
        // If already flat (nodes+edges)
        if (raw && typeof raw === "object" && "nodes" in raw && Array.isArray(raw.nodes) && "edges" in raw && Array.isArray(raw.edges)) {
          graph = raw as ASTGraph;
        } else {
          // Otherwise flatten nested AST
          const separator = new ASTNodesSeparator();
          graph = separator.build([raw as ASTNodes]);
        }
        result[key] = graph;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ error: msg });
        return;
      }
    }

    res.json(result);
  });

  app.listen(PORT_NUM, () => {
    console.log(`🚀 Server running at http://localhost:${PORT_STR}`);
  });
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
  console.error("Startup failed:", msg);
  process.exit(1);
});
