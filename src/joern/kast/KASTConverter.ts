/* eslint-disable @typescript-eslint/no-unused-vars */
import { ASTNodes } from "@/types/node";

import { TreeNodeInfo } from "../ast/ASTExtractor";

export class KASTConverter {
  /** Convert an array (“forest”) of root nodes into ASTNodes[], skipping undefined conversions. */
  public convertForest(nodes: TreeNodeInfo[]): ASTNodes[] {
    const convertedNodes: ASTNodes[] = [];
    for (const node of nodes) {
      const single = this.convertTree(node);
      if (single !== undefined) {
        convertedNodes.push(single);
      }
    }
    return convertedNodes;
  }

  /**
   * Convert one TreeNodeInfo into ASTNodes (or undefined if this node should be omitted).
   * We first dispatch to handle payload, then recurse on children.
   */
  public convertTree(node: TreeNodeInfo): ASTNodes | undefined {
    const converted = this.dispatchConvert(node);
    if (converted === undefined) {
      return undefined;
    }

    const childNodes: ASTNodes[] = [];
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const childConv = this.convertTree(child);
        if (childConv !== undefined) {
          childNodes.push(childConv);
        }
      }
    }

    return {
      ...converted,
      children: childNodes,
    };
  }

  /**
   * Dispatch helper: switch on node.label, extract payload, call the correct handler.
   * Returns ResultMap[...] or undefined.
   */
  private dispatchConvert(node: TreeNodeInfo): ASTNodes | undefined {
    switch (node.label) {
      case "BINDING": {
        this.handleBinding(node);
        return;
      }
      case "BLOCK": {
        this.handleBlock(node);
        return;
      }
      case "CALL": {
        this.handleCall(node);
        return;
      }
      case "CONTROL_STRUCTURE": {
        this.handleControlStructure(node);
        return;
      }
      case "DEPENDENCY": {
        this.handleDependency(node);
        return;
      }
      case "FILE": {
        this.handleFile(node);
        return;
      }
      case "IDENTIFIER": {
        this.handleIdentifier(node);
        return;
      }
      case "IMPORT": {
        this.handleImport(node);
        return;
      }
      case "LITERAL": {
        this.handleLiteral(node);
        return;
      }
      case "LOCAL": {
        this.handleLocal(node);
        return;
      }
      case "META_DATA": {
        this.handleMetaData(node);
        return;
      }
      case "METHOD": {
        this.handleMethod(node);
        return;
      }
      case "METHOD_PARAMETER_IN": {
        this.handleMethodParamIn(node);
        return;
      }
      case "METHOD_PARAMETER_OUT": {
        this.handleMethodParamOut(node);
        return;
      }
      case "METHOD_REF": {
        this.handleMethodRef(node);
        return;
      }
      case "METHOD_RETURN": {
        this.handleMethodReturn(node);
        return;
      }
      case "MODIFIER": {
        this.handleModifier(node);
        return;
      }
      case "NAMESPACE": {
        this.handleNamespace(node);
        return;
      }
      case "NAMESPACE_BLOCK": {
        this.handleNamespaceBlock(node);
        return;
      }
      case "TYPE": {
        this.handleType(node);
        return;
      }
      case "TYPE_DECL": {
        this.handleTypeDecl(node);
        return;
      }
      default:
        return assertNever(node.label);
    }
  }

  private handleBinding(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleBlock(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleCall(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleControlStructure(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleDependency(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleFile(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleIdentifier(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleImport(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleLiteral(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleLocal(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleMetaData(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleMethod(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleMethodParamIn(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleMethodParamOut(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleMethodRef(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleMethodReturn(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleModifier(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleNamespace(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleNamespaceBlock(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleType(node: TreeNodeInfo): undefined {
    return undefined;
  }

  private handleTypeDecl(node: TreeNodeInfo): undefined {
    return undefined;
  }
}

function assertNever(x: unknown): never {
  throw new Error("Unexpected label: " + JSON.stringify(x));
}
