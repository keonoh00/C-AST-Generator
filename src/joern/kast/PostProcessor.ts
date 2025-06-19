import { ASTNodes } from "@/types/node";

export class PostProcessor {
  /**
   * Walk the AST and remove any nodes with a missing or invalid nodeType,
   * inlining their children instead.
   */
  public process(nodes: ASTNodes[]): ASTNodes[] {
    return nodes.flatMap((node) => this.processNode(node));
  }

  private processNode(node: ASTNodes): ASTNodes[] {
    // Detect fallback/unconverted nodes by checking nodeType
    const nodeKeys = Object.keys(node);
    if (!nodeKeys.includes("nodeType")) {
      // Inline grandchildren
      return (node.children ?? []).flatMap((child) => this.processNode(child));
    }

    // Otherwise, keep this node but recurse into its children
    const processedChildren = (node.children ?? []).flatMap((child) => this.processNode(child));
    return [
      {
        ...node,
        children: processedChildren,
      },
    ];
  }
}
