/* eslint-disable @typescript-eslint/no-unused-vars */

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { IStructType } from "@/types/DataTypes/StructType";
import { ITypeDefinition } from "@/types/DataTypes/TypeDefinition";
import { IUnionType } from "@/types/DataTypes/UnionType";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { LocalVertexProperties, MethodParameterInVertexProperties, MethodVertexProperties, TreeNode, TypeDeclVertexProperties } from "@/types/joern";
import { ASTNodes } from "@/types/node";
import { IFunctionDeclaration } from "@/types/ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "@/types/ProgramStructures/FunctionDefinition";
import { IParameterDeclaration } from "@/types/ProgramStructures/ParameterDeclaration";
import { IParameterList } from "@/types/ProgramStructures/ParameterList";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import { IVariableDeclaration } from "@/types/ProgramStructures/VariableDeclaration";

export class KASTConverter {
  /** Convert an array (“forest”) of root nodes into ASTNodes[], skipping undefined conversions. */
  public convertTree(nodes: TreeNode[]): ASTNodes[] {
    const convertedNodes: ASTNodes[] = [];
    for (const node of nodes) {
      const single = this.dispatchConvert(node);
      if (single !== undefined) {
        convertedNodes.push(single);
      }
    }
    return convertedNodes;
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
      case "METHOD_PARAMETER_OUT":
      case "METHOD_REF":
      case "METHOD_RETURN":
      case "MODIFIER":
      case "NAMESPACE":
      case "NAMESPACE_BLOCK":
      case "RETURN":
      case "TYPE":
      case "TYPE_REF":
        return this.handleSkippedNodes(node);
      case "CALL":
        return this.handleCall(node);
      case "FILE":
        return this.handleFile(node);
      case "LOCAL":
        return this.handleLocal(node);
      case "METHOD":
        return this.handleMethod(node);
      case "METHOD_PARAMETER_IN":
        return this.handleMethodParamIn(node);
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
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    // TODO: Change to undefined after development, temoporal fix to handle childen that does not match the label yet.
    return {
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as IAssignmentExpression;
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
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
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
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    };
  }

  private handleMetaData(node: TreeNode): undefined {
    return undefined;
  }

  private handleMethod(node: TreeNode): IFunctionDeclaration | IFunctionDefinition | undefined {
    const properties = node.properties as unknown as MethodVertexProperties;

    const firstBlock = node.children.find((child) => child.label === "BLOCK");

    if (
      properties.FILENAME["@value"]["@value"][0] + ":<global>" === properties.AST_PARENT_FULL_NAME["@value"]["@value"][0] &&
      !properties.IS_EXTERNAL["@value"]["@value"][0] &&
      properties.SIGNATURE["@value"]["@value"].join("/").length > 0
    ) {
      const paramList: IParameterList = {
        nodeType: ASTNodeTypes.ParameterList,
        id: Number(node.id) || -999,
        children: node.children
          .filter((child) => child.label === "METHOD_PARAMETER_IN")
          .map((child) => this.dispatchConvert(child))
          .filter((child): child is IParameterDeclaration => child !== undefined),
      };
      const nonFuncParamChildren = node.children
        .filter((child) => child.label !== "METHOD_PARAMETER_IN")
        .map((child) => this.dispatchConvert(child))
        .filter((child): child is ASTNodes => child !== undefined);

      return {
        nodeType: firstBlock && firstBlock.code === "<empty>" ? ASTNodeTypes.FunctionDeclaration : ASTNodeTypes.FunctionDefinition,
        id: Number(node.id) || -999,
        name: node.name,
        returnType: properties.SIGNATURE["@value"]["@value"].join("/"),
        children: paramList.children && paramList.children.length > 0 ? [paramList, ...nonFuncParamChildren] : nonFuncParamChildren,
      };
    }

    // TODO: Change to undefined after development, temoporal fix to handle childen that does not match the label yet.
    return {
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as IFunctionDeclaration;
  }

  private handleMethodParamIn(node: TreeNode): IParameterDeclaration | undefined {
    const properties = node.properties as unknown as MethodParameterInVertexProperties;
    if (properties.TYPE_FULL_NAME["@value"]["@value"].length === 0) {
      throw new Error(`Method parameter in node ${node.id} has no type.`);
    }
    return {
      nodeType: ASTNodeTypes.ParameterDeclaration,
      id: Number(node.id) || -999,
      name: node.name,
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    };
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

  private handleSkippedNodes(node: TreeNode): ASTNodes | undefined {
    return {
      ...(node as unknown as ASTNodes),
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    };
  }

  private handleType(node: TreeNode): undefined {
    return undefined;
  }

  private handleTypeDecl(node: TreeNode): IStructType | ITypeDefinition | IUnionType | undefined {
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
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
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
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (node.code.includes("typedef")) {
      return {
        nodeType: ASTNodeTypes.TypeDefinition,
        id: Number(node.id) || -999,
        name: node.name,
        underlyingType: properties.ALIAS_TYPE_FULL_NAME["@value"]["@value"].join("/"),
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    // TODO: Change to undefined after development, temoporal fix to handle childen that does not match the label yet.
    return {
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as IStructType;
  }
}

function assertNever(x: unknown): never {
  throw new Error("Unexpected label: " + JSON.stringify(x));
}
