/* eslint-disable @typescript-eslint/no-unused-vars */

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { IStructType } from "@/types/DataTypes/StructType";
import { ITypeDefinition } from "@/types/DataTypes/TypeDefinition";
import { IUnionType } from "@/types/DataTypes/UnionType";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { CallVertexProperties, LocalVertexProperties, TreeNode, TypeDeclVertexProperties } from "@/types/joern";
import { ASTNodes } from "@/types/node";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import { IVariableDeclaration } from "@/types/ProgramStructures/VariableDeclaration";

export class KASTConverter {
  /** Convert an array (“forest”) of root nodes into ASTNodes[], skipping undefined conversions. */
  public convertForest(nodes: TreeNode[]): ASTNodes[] {
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
   * Convert one TreeNode into ASTNodes (or undefined if this node should be omitted).
   * We first dispatch to handle payload, then recurse on children.
   */
  public convertTree(node: TreeNode): ASTNodes | undefined {
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
  private dispatchConvert(node: TreeNode): ASTNodes | undefined {
    switch (node.label) {
      case "BINDING":
      case "BLOCK":

      case "CONTROL_STRUCTURE":
      case "DEPENDENCY":
      case "FIELD_IDENTIFIER":
      case "IDENTIFIER":
      case "IMPORT":
      case "JUMP_TARGET":
      case "LITERAL":
      case "MEMBER":
      case "META_DATA":
      case "METHOD":
      case "METHOD_PARAMETER_IN":
      case "METHOD_PARAMETER_OUT":
      case "METHOD_REF":
      case "METHOD_RETURN":
      case "MODIFIER":
      case "NAMESPACE":
      case "NAMESPACE_BLOCK":
      case "RETURN":
      case "TYPE":
      case "TYPE_REF":
        return undefined;

      case "CALL":
        return this.handleCall(node);
      case "FILE":
        return this.handleFile(node);
      case "LOCAL":
        return this.handleLocal(node);
      case "TYPE_DECL":
        return this.handleTypeDecl(node);
      default:
        return assertNever(node.label);
    }
  }

  private handleBinding(node: TreeNode): undefined {
    return undefined;
  }

  private handleBlock(node: TreeNode): undefined {
    return undefined;
  }

  private handleCall(node: TreeNode): IAssignmentExpression | undefined {
    if (node.name === "<operator>.assignment") {
      if (node.children.length !== 2) {
        throw new Error(`Call node ${node.id} has ${node.children.length.toString()} children, expected 2.`);
      }

      return {
        nodeType: ASTNodeTypes.AssignmentExpression,
        id: Number(node.id) || -999,
        operator: "=",
        children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    return undefined;
  }

  private handleControlStructure(node: TreeNode): undefined {
    return undefined;
  }

  private handleDependency(node: TreeNode): undefined {
    return undefined;
  }

  private handleFile(node: TreeNode): ITranslationUnit | undefined {
    if (node.name.endsWith(".c") || node.name.endsWith(".cpp")) {
      return {
        nodeType: ASTNodeTypes.TranslationUnit,
        id: Number(node.id) || -999,
        children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    return undefined;
  }

  private handleIdentifier(node: TreeNode): undefined {
    return undefined;
  }

  private handleImport(node: TreeNode): undefined {
    return undefined;
  }

  private handleLiteral(node: TreeNode): undefined {
    return undefined;
  }

  private handleLocal(node: TreeNode): IVariableDeclaration {
    const properties = node.properties as unknown as LocalVertexProperties;
    return {
      nodeType: ASTNodeTypes.VariableDeclaration,
      id: Number(node.id) || -999,
      name: node.name,
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/") as string,
      children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
    };
  }

  private handleMetaData(node: TreeNode): undefined {
    return undefined;
  }

  private handleMethod(node: TreeNode): undefined {
    return undefined;
  }

  private handleMethodParamIn(node: TreeNode): undefined {
    return undefined;
  }

  private handleMethodParamOut(node: TreeNode): undefined {
    return undefined;
  }

  private handleMethodRef(node: TreeNode): undefined {
    return undefined;
  }

  private handleMethodReturn(node: TreeNode): undefined {
    return undefined;
  }

  private handleModifier(node: TreeNode): undefined {
    return undefined;
  }

  private handleNamespace(node: TreeNode): undefined {
    return undefined;
  }

  private handleNamespaceBlock(node: TreeNode): undefined {
    return undefined;
  }

  private handleType(node: TreeNode): undefined {
    return undefined;
  }

  private handleTypeDecl(node: TreeNode): IUnionType | IStructType | ITypeDefinition | undefined {
    const properties = node.properties as unknown as TypeDeclVertexProperties;

    if (node.code.includes("typedef struct")) {
      if (node.children.filter((child) => child.children.length > 0).length > 1) {
        throw new Error(`Struct node ${node.id} has more than one child with children.`);
      }
      if (node.children.filter((child) => child.label !== "MEMBER").length > 1) {
        throw new Error(`Struct node ${node.id} has more than one child with label MEMBER.`);
      }
      return {
        nodeType: ASTNodeTypes.StructType,
        id: Number(node.id) || -999,
        name: node.name,
        children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (node.code.includes("typedef union")) {
      if (node.children.length === 0) {
        throw new Error(`Union node ${node.id} has no children.`);
      }
      if (node.children.filter((child) => child.children.length > 0).length > 1) {
        throw new Error(`Union node ${node.id} has more than one child with children.`);
      }
      if (node.children.filter((child) => child.label !== "MEMBER").length > 1) {
        throw new Error(`Union node ${node.id} has more than one child with label MEMBER.`);
      }
      return {
        nodeType: ASTNodeTypes.UnionType,
        id: Number(node.id) || -999,
        name: node.name,
        children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (properties.ALIAS_TYPE_FULL_NAME && node.code.includes("typedef")) {
      return {
        nodeType: ASTNodeTypes.TypeDefinition,
        id: Number(node.id) || -999,
        name: node.name,
        underlyingType: properties.ALIAS_TYPE_FULL_NAME["@value"]["@value"].join("/") as string,
        children: node.children.map((child) => this.convertTree(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }
    return undefined;
  }
}

function assertNever(x: unknown): never {
  throw new Error("Unexpected label: " + JSON.stringify(x));
}
