/* eslint-disable @typescript-eslint/no-unused-vars */
import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ASTNodes } from "@/types/node";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";

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
      case "BINDING":
      case "BLOCK":
      case "CALL":
      case "CONTROL_STRUCTURE":
      case "DEPENDENCY":
      case "IDENTIFIER":
      case "IMPORT":
      case "LITERAL":
      case "LOCAL":
      case "META_DATA":
      case "METHOD":
      case "METHOD_PARAMETER_IN":
      case "METHOD_PARAMETER_OUT":
      case "METHOD_REF":
      case "METHOD_RETURN":
      case "MODIFIER":
      case "NAMESPACE":
      case "NAMESPACE_BLOCK":
      case "TYPE":
      case "TYPE_DECL":
        return undefined;
      case "FILE":
        return this.handleFile(node);
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

  private handleFile(node: TreeNodeInfo): ITranslationUnit | undefined {
    if (node.children.length === 0) {
      return undefined; // No children means no meaningful ASTNode can be created
    }

    if (!node.name.endsWith(".c") || !node.name.endsWith(".cpp")) {
      return undefined; // Only handle C/C++ files
    }

    return {
      children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
      id: Number(node.id) || -999,
      nodeType: ASTNodeTypes.TranslationUnit,
    };
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
