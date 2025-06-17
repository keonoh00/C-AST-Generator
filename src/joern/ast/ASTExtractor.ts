// src/joern/ast/ASTExtractor.ts

import { GraphData, GraphSON, GraphSONValue, RootGraphSON, VertexGeneric } from "@/types/joern";

export interface NodeInfo {
  code: string;
  id: string;
  label: string;
  line_no: string;
  name: string;
  properties: Record<string, unknown>;
}

export type NodeTree = NodeInfo & { children: NodeTree[] };
export type RawVertexTree = VertexGeneric & { children: RawVertexTree[] };

export class ASTExtractor {
  extractMultiple(roots: RootGraphSON[]): (NodeTree[] | RawVertexTree[])[] {
    return roots.map((r) => this.extractSingle(r));
  }

  extractSingle(root: RootGraphSON): NodeTree[] | RawVertexTree[] {
    const { childrenMap, nodeDict } = this.buildMaps(root);
    return this.buildForest(nodeDict, childrenMap);
  }

  private buildForest(nodeDict: Record<string, VertexGeneric>, childrenMap: Record<string, string[]>): NodeTree[] | RawVertexTree[] {
    const allIds = Object.keys(nodeDict);
    const childIds = new Set(Object.values(childrenMap).flat());
    const roots = allIds.filter((id) => !childIds.has(id));

    const cache: Record<string, NodeInfo> = {};
    const makeNode = (id: string): NodeTree => {
      cache[id] = this.convertVertex(nodeDict[id]);
      const info = cache[id];
      return {
        ...info,
        children: childrenMap[id].map(makeNode),
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

    for (const v of Array.isArray(graphData.vertices) ? graphData.vertices : []) {
      const vid = this.idOf(v.id);
      if (vid) {
        nodeDict[vid] = v;
        childrenMap[vid] = [];
      }
    }

    for (const e of Array.isArray(graphData.edges) ? graphData.edges : []) {
      if (e.label !== "AST") continue;
      const p = this.idOf(e.outV);
      const c = this.idOf(e.inV);
      if (p && c) {
        childrenMap[p].push(c);
      }
    }

    return { childrenMap, nodeDict };
  }

  private convertVertex(v: VertexGeneric): NodeInfo {
    const rawProps = v.properties as unknown as Record<string, unknown>;
    return {
      code: this.firstPrimitive(rawProps.CODE),
      id: this.idOf(v.id) ?? "",
      label: v.label,
      line_no: this.firstPrimitive(rawProps.LINE_NUMBER),
      name: this.firstPrimitive(rawProps.NAME),
      properties: rawProps,
    };
  }

  private firstPrimitive(raw: unknown): string {
    if (typeof raw !== "object" || raw === null || !Array.isArray((raw as Record<string, unknown>)["@value"])) {
      return "";
    }
    for (const el of (raw as Record<string, unknown>)["@value"] as unknown[]) {
      if (typeof el === "string" || typeof el === "number" || typeof el === "boolean") {
        return String(el);
      }
      if (typeof el === "object" && el !== null && "@value" in el) {
        const inner = (el as Record<string, unknown>)["@value"];
        if (typeof inner === "string" || typeof inner === "number" || typeof inner === "boolean") {
          return String(inner);
        }
      }
    }
    return "";
  }

  private idOf(raw?: GraphSON<GraphSONValue>): string | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const v = (raw as unknown as Record<string, unknown>)["@value"];
    return typeof v === "string" || typeof v === "number" ? String(v) : undefined;
  }
}
