import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ASTNodes } from "@/types/node";

/**
 * Filters nested children, removes blacklisted node types,
 * and always returns one ASTNodes per input node (preserving length).
 */
export class ASTFilter {
  private blacklist: ASTNodeTypes[];

  constructor(blacklist: ASTNodeTypes[]) {
    this.blacklist = blacklist;
  }

  /**
   * Process an array of ASTNodes, filtering & flattening as needed.
   * The output array will have the same length as `nodes`.
   */
  public filterNodes(nodes: ASTNodes[]): ASTNodes[] {
    return nodes.map((node) => {
      const result = this.excludeSingleNestedNode(node);

      if (result === undefined) {
        // Everything got filtered out → return a shallow copy with no children
        const stub: ASTNodes = { ...node };
        delete stub.children;
        return stub;
      }

      if (Array.isArray(result)) {
        // Root was blacklisted but children survived → wrap them under original node
        const wrapped: ASTNodes = { ...node, children: result };
        return wrapped;
      }

      // Single-node result: keep it
      return result;
    });
  }

  /**
   * Recursively filter a single node.
   * @returns
   *   - `undefined` if this node & its descendants are all removed,
   *   - A single ASTNodes if this node remains (with filtered children),
   *   - An array of ASTNodes if this node is removed but some children remain.
   */
  private excludeSingleNestedNode(node: ASTNodes): ASTNodes | ASTNodes[] | undefined {
    const acc: ASTNodes[] = [];

    if (node.children) {
      for (const child of node.children) {
        const filteredChild = this.excludeSingleNestedNode(child);
        if (filteredChild === undefined) continue;
        if (Array.isArray(filteredChild)) acc.push(...filteredChild);
        else acc.push(filteredChild);
      }
    }

    if (this.blacklist.includes(node.nodeType)) {
      return acc.length > 0 ? acc : undefined;
    }

    // Keep this node, attach any filtered children
    const kept: ASTNodes = { ...node };
    if (acc.length > 0) kept.children = acc;
    else delete kept.children;
    return kept;
  }
}
