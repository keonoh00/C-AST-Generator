import { ASTNodes } from "@/types/node";

export class PostProcessor {
  /**
   * Walk the AST and remove any nodes with a missing or invalid nodeType,
   * inlining their children instead.
   */
  public removeInvalidNodes(nodes: ASTNodes[]): ASTNodes[] {
    const validateNode = (node: ASTNodes): ASTNodes[] => {
      const nodeKeys = Object.keys(node);
      if (!nodeKeys.includes("nodeType")) {
        // Inline grandchildren
        return (node.children ?? []).flatMap((child) => validateNode(child));
      }
      // Otherwise, keep this node but recurse into its children
      const processedChildren = (node.children ?? []).flatMap((child) => validateNode(child));
      return [
        {
          ...node,
          children: processedChildren,
        },
      ];
    };

    return nodes.flatMap((node) => validateNode(node));
  }
}
