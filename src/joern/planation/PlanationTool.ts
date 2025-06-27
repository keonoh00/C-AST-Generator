import { ASTNodes } from "@/types/node";

export interface ASTGraph {
  edges: { from: number; to: number }[];
  nodes: (ASTNodes & { id: number })[];
}

export class PlanationTool {
  private edges: { from: number; to: number }[] = [];
  private idCounter = 0;
  private nodes: (ASTNodes & { id: number })[] = [];

  /**
   * Given an array of root ASTNodes, returns one ASTGraph per root,
   * where each graph has a flat list of nodes (with unique ids) and edges.
   */
  public flatten(astRoots: ASTNodes[]): ASTGraph[] {
    const graphs: ASTGraph[] = [];

    for (const root of astRoots) {
      this.reset();
      this.traverse(root);

      // sort nodes by ascending id
      this.nodes.sort((a, b) => a.id - b.id);
      // sort edges by ascending sum of from+to
      this.edges.sort((e1, e2) => e1.from + e1.to - (e2.from + e2.to));

      // sanity-check that every edge references existing node ids
      this.validateEdges();

      graphs.push({
        edges: this.edges.slice(),
        nodes: this.nodes.slice(),
      });
    }

    return graphs;
  }

  /** Reset all internal state before processing a new root. */
  private reset(): void {
    this.edges = [];
    this.nodes = [];
    this.idCounter = 0;
  }

  /**
   * Walk the AST recursively, strip `children`, assign each node a unique `id`,
   * record the node and then traverse its children, recording an edge for each.
   * @returns the `id` assigned to this node
   */
  private traverse(node: ASTNodes & { children?: ASTNodes[] }): number {
    const id = this.idCounter++;

    // clone node minus its children, attach id
    const { children, ...rest } = node;
    const clone: ASTNodes & { id: number } = { ...(rest as ASTNodes), id };
    this.nodes.push(clone);

    if (Array.isArray(children)) {
      for (const child of children) {
        const childId = this.traverse(child);
        this.edges.push({ from: id, to: childId });
      }
    }

    return id;
  }

  /**
   * Verify that each edge's `from` and `to` refer to an actual node ID in `this.nodes`.
   * Throws an error if any dangling reference is found.
   */
  private validateEdges(): void {
    const existingIds = new Set(this.nodes.map((n) => n.id));
    for (const { from, to } of this.edges) {
      if (!existingIds.has(from)) {
        throw new Error(`Edge refers to unknown source node id ${from.toString()}`);
      }
      if (!existingIds.has(to)) {
        throw new Error(`Edge refers to unknown target node id ${to.toString()}`);
      }
    }
  }
}
