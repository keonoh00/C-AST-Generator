// src/parser/separator/ASTNodesSeparator.ts

import { ASTNodes } from "@/types/node";

export interface ASTGraph {
  edges: { from: number; to: number }[];
  nodes: (ASTNodes & { id: number })[];
}

export class ASTNodesSeparator {
  private edges: { from: number; to: number }[] = [];
  private idCounter = 0;
  private nodes: (ASTNodes & { id: number })[] = [];

  public build(astRoots: ASTNodes[]): ASTGraph[] {
    const graphs: ASTGraph[] = [];
    for (const root of astRoots) {
      this.reset();
      this.traverse(root);
      graphs.push({
        edges: this.edges.slice(),
        nodes: this.nodes.slice(),
      });
    }
    return graphs;
  }

  private reset(): void {
    this.edges = [];
    this.nodes = [];
    this.idCounter = 0; // ← reset here!
  }

  private traverse(node: ASTNodes & { children?: ASTNodes[] }): number {
    const id = this.idCounter++;

    // shallow-clone node without its children, add our new id
    const { children, ...rest } = node;
    const clone: ASTNodes & { id: number } = {
      ...(rest as ASTNodes),
      id,
    };
    this.nodes.push(clone);

    // recurse into the real children, record edges
    if (Array.isArray(children)) {
      for (const child of children) {
        const childId = this.traverse(child);
        this.edges.push({ from: id, to: childId });
      }
    }

    return id;
  }
}
