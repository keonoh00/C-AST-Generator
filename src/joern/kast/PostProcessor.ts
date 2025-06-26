import { ASTNodes } from "@/types/node";

export class PostProcessor {
  /**
   * Walk the AST and remove any nodes with a missing or invalid nodeType,
   * inlining their children instead.
   */
  public removeInvalidNodes(nodes: ASTNodes[]): ASTNodes[] {
    return nodes.flatMap((node) => this.validateNode(node));
  }

  private validateNode(node: ASTNodes): ASTNodes[] {
    const nodeKeys = Object.keys(node);
    if (!nodeKeys.includes("nodeType")) {
      // Inline grandchildren
      return (node.children ?? []).flatMap((child) => this.validateNode(child));
    }
    // Otherwise, keep this node but recurse into its children
    const processedChildren = (node.children ?? []).flatMap((child) => this.validateNode(child));
    return [
      {
        ...node,
        children: processedChildren,
      },
    ];
  }
}
