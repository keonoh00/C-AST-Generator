import { ASTNodes } from "@/types/node";

export interface ASTGraph {
  edges: { from: number; to: number }[];
  nodes: ASTNodes[];
}

export class ASTNodesSeparator {
  private edges: { from: number; to: number }[] = [];
  private idCounter = 0;
  private nodes: ASTNodes[] = [];

  /**
   * Public entry: given an array of root ASTNodes, returns an array of ASTGraphs—one per root.
   */
  public build(astRoots: ASTNodes[]): ASTGraph[] {
    const graphs: ASTGraph[] = [];
    for (const root of astRoots) {
      this.reset();
      this.traverse(root);
      graphs.push({ edges: this.edges.slice(), nodes: this.nodes.slice() });
    }
    return graphs;
  }

  /** Reset internal state between builds */
  private reset(): void {
    this.edges = [];
    this.nodes = [];
  }

  /**
   * Recursively traverse the AST, assign an id to each node,
   * strip children, record nodes, and record edges parent→child.
   * @returns assigned id of this node
   */
  private traverse(node: ASTNodes): number {
    const { children } = node as ASTNodes & { children?: ASTNodes[] };

    this.nodes.push(node);

    if (children) {
      for (const child of children) {
        const childId = this.traverse(child);
        this.edges.push({ from: node.id, to: childId });
      }
    }
    return node.id;
  }
}
