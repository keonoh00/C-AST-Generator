// src/parser/filter/GraphFilter.ts

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";

import { ASTGraph } from "../separator";

/**
 * Removes blacklisted node‐types (and any incident edges)
 * from one or more ASTGraph instances.
 */
export class ASTGraphFilter {
  private blacklist: Set<ASTNodeTypes>;

  constructor(blacklist: ASTNodeTypes[]) {
    this.blacklist = new Set(blacklist);
  }

  /**
   * For each graph:
   * 1. Drop any node whose nodeType is in the blacklist.
   * 2. Drop any edge referencing a dropped node.
   */
  public filter(graphs: ASTGraph[]): ASTGraph[] {
    return graphs.map((g) => this.filterSingle(g));
  }

  private filterSingle(graph: ASTGraph): ASTGraph {
    // 1) compute which node‐IDs survive
    const keepIds = new Set<number>();
    for (const node of graph.nodes) {
      if (!this.blacklist.has(node.nodeType)) {
        keepIds.add(node.id);
      }
    }

    // 2) filter nodes array
    const nodes = graph.nodes.filter((n) => keepIds.has(n.id));

    // 3) filter edges array
    const edges = graph.edges.filter((e) => keepIds.has(e.from) && keepIds.has(e.to));

    return { edges, nodes };
  }
}
