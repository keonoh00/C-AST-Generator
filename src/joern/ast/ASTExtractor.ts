import { GraphData, GraphSON, GraphSONValue, RootGraphSON, VertexGeneric } from "@/types/joern";

export interface ASTExtractorOptions {
  raw?: boolean;
}

export interface NodeInfo {
  code: string;
  id: string;
  label: string;
  line_no: string;
  name: string;
  properties: Record<string, unknown>;
}

export type RawVertexTree = VertexGeneric & { children: RawVertexTree[] };
export type TreeNodeInfo = NodeInfo & { children: TreeNodeInfo[] };

export class ASTExtractor {
  private options: ASTExtractorOptions;

  constructor(options?: ASTExtractorOptions) {
    this.options = options ?? {};
  }

  extractMultiple(roots: RootGraphSON[], optionsOverride?: ASTExtractorOptions): (RawVertexTree[] | TreeNodeInfo[])[] {
    return roots.map((r) => this.extractSingle(r, optionsOverride));
  }

  extractSingle(root: RootGraphSON, optionsOverride?: ASTExtractorOptions): RawVertexTree[] | TreeNodeInfo[] {
    const opts = optionsOverride ?? this.options;
    const { childrenMap, nodeDict } = this.buildMaps(root);
    if (opts.raw) {
      return this.buildRawForest(nodeDict, childrenMap);
    } else {
      return this.buildInfoForest(nodeDict, childrenMap);
    }
  }

  private buildInfoForest(nodeDict: Record<string, VertexGeneric>, childrenMap: Record<string, string[]>): TreeNodeInfo[] {
    const allIds = Object.keys(nodeDict);
    const childIds = new Set(Object.values(childrenMap).flat());
    const roots = allIds.filter((id) => !childIds.has(id));
    const cache: Record<string, NodeInfo> = {};
    const makeNode = (id: string): TreeNodeInfo => {
      cache[id] = this.convertVertex(nodeDict[id]);

      const info = cache[id];
      const childList = childrenMap[id];
      return {
        ...info,
        children: childList.map(makeNode),
      };
    };
    return roots.map(makeNode);
  }

  private buildMaps(root: RootGraphSON): {
    childrenMap: Record<string, string[]>;
    nodeDict: Record<string, VertexGeneric>;
  } {
    const nodeDict: Record<string, VertexGeneric> = {};
    const childrenMap: Record<string, string[]> = {};
    const { "@value": graphData } = root as GraphSON<GraphData>;
    if (Array.isArray(graphData.vertices)) {
      for (const v of graphData.vertices) {
        const vid = this.idOf(v.id);
        if (vid) {
          nodeDict[vid] = v;
          childrenMap[vid] = [];
        }
      }
    }
    if (Array.isArray(graphData.edges)) {
      for (const e of graphData.edges) {
        if (e.label !== "AST") continue;
        const p = this.idOf(e.outV);
        const c = this.idOf(e.inV);
        if (p && c) {
          childrenMap[p].push(c);
        }
      }
    }
    return { childrenMap, nodeDict };
  }

  private buildRawForest(nodeDict: Record<string, VertexGeneric>, childrenMap: Record<string, string[]>): RawVertexTree[] {
    const allIds = Object.keys(nodeDict);
    const childIds = new Set(Object.values(childrenMap).flat());
    const roots = allIds.filter((id) => !childIds.has(id));
    const makeRawNode = (id: string): RawVertexTree => {
      const v = nodeDict[id];
      const childList = childrenMap[id];
      return {
        ...v,
        children: childList.map(makeRawNode),
      };
    };
    return roots.map(makeRawNode);
  }

  private convertVertex(v: VertexGeneric): NodeInfo {
    const rawProps = v.properties as unknown as Record<string, unknown>;
    return {
      code: this.firstPrimitiveNested(rawProps.CODE),
      id: this.idOf(v.id) ?? "",
      label: v.label,
      line_no: this.extractLineNo(rawProps.LINE_NUMBER),
      name: this.firstPrimitiveNested(rawProps.NAME),
      properties: rawProps,
    };
  }

  private extractLineNo(raw: unknown): string {
    if (raw == null || typeof raw !== "object") return "";
    const rawObj = raw as Record<string, unknown>;
    let current: unknown = rawObj["@value"];
    for (let depth = 0; depth < 5; depth++) {
      if (current == null) return "";
      if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
        return String(current);
      }
      if (Array.isArray(current)) {
        if (current.length === 0) return "";
        current = current[0];
        continue;
      }
      if (typeof current === "object") {
        const asObj = current as Record<string, unknown>;
        if ("@value" in asObj) {
          current = asObj["@value"];
          continue;
        }
        return "";
      }
      return "";
    }
    return "";
  }

  private firstPrimitiveNested(raw: unknown): string {
    if (raw == null || typeof raw !== "object") {
      return "";
    }
    let current: unknown = (raw as Record<string, unknown>)["@value"];
    for (let depth = 0; depth < 5; depth++) {
      if (current == null) {
        return "";
      }
      if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
        return String(current);
      }
      if (Array.isArray(current)) {
        if (current.length === 0) {
          return "";
        }
        current = current[0];
        continue;
      }
      if (typeof current === "object") {
        const asObj = current as Record<string, unknown>;
        if ("@value" in asObj) {
          current = asObj["@value"];
          continue;
        }
        return "";
      }
      return "";
    }
    return "";
  }

  private idOf(raw?: GraphSON<GraphSONValue>): string | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const v = (raw as unknown as Record<string, unknown>)["@value"];
    if (typeof v === "string" || typeof v === "number") {
      return String(v);
    }
    return undefined;
  }
}
