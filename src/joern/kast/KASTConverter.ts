/* eslint-disable @typescript-eslint/no-unused-vars */

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ICompoundStatement } from "@/types/Block/CompoundStatement";
import { IIfStatement } from "@/types/ControlStructures/IfStatement";
import { IStructType } from "@/types/DataTypes/StructType";
import { ITypeDefinition } from "@/types/DataTypes/TypeDefinition";
import { IUnionType } from "@/types/DataTypes/UnionType";
import { IArraySubscriptionExpression } from "@/types/Expressions/ArraySubscriptExpression";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { IBinaryExpression } from "@/types/Expressions/BinaryExpression";
import { ICastExpression } from "@/types/Expressions/CastExpression";
import { IIdentifier } from "@/types/Expressions/Identifier";
import { ILiteral } from "@/types/Expressions/Literal";
import { IMemberAccess } from "@/types/Expressions/MemberAccess";
import { ISizeOfExpression } from "@/types/Expressions/SizeOfExpression";
import { IStandardLibCall } from "@/types/Expressions/StandardLibCall";
import { IUnaryExpression } from "@/types/Expressions/UnaryExpression";
import { IUserDefinedCall } from "@/types/Expressions/UserDefinedCall";
import {
  CallVertexProperties,
  ControlStructureVertexProperties,
  IdentifierVertexProperties,
  LiteralVertexProperties,
  LocalVertexProperties,
  MethodParameterInVertexProperties,
  MethodVertexProperties,
  TreeNode,
  TypeDeclVertexProperties,
} from "@/types/joern";
import { ASTNodes } from "@/types/node";
import { IArrayDeclaration } from "@/types/ProgramStructures/ArrayDeclaration";
import { IFunctionDeclaration } from "@/types/ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "@/types/ProgramStructures/FunctionDefinition";
import { IParameterDeclaration } from "@/types/ProgramStructures/ParameterDeclaration";
import { IParameterList } from "@/types/ProgramStructures/ParameterList";
import { IPointerDeclaration } from "@/types/ProgramStructures/PointerDeclaration";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import { IVariableDeclaration } from "@/types/ProgramStructures/VariableDeclaration";

import { BinaryExpressionOperatorMap } from "./BinaryExpression";
import { STANDARD_LIB_CALLS } from "./StandardLibCall";
import { UnaryExpressionOperatorMap } from "./UnaryExpression";

type CallOperatorsReturnTypes =
  | IArraySubscriptionExpression
  | IAssignmentExpression
  | IBinaryExpression
  | ICastExpression
  | IMemberAccess
  | ISizeOfExpression
  | IUnaryExpression
  | undefined;

type CallReturnTypes = CallOperatorsReturnTypes | IStandardLibCall | IUserDefinedCall;

export class KASTConverter {
  private callCollection: string[];

  constructor() {
    this.callCollection = [];
  }
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
      case "DEPENDENCY":
      case "FIELD_IDENTIFIER":
      case "IMPORT":
      case "JUMP_TARGET":
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

      case "BLOCK":
        return this.handleBlock(node);
      case "CALL":
        return this.handleCall(node);
      case "CONTROL_STRUCTURE":
        return this.handleControlStructure(node);
      case "FILE":
        return this.handleFile(node);
      case "IDENTIFIER":
        return this.handleIdentifier(node);
      case "LITERAL":
        return this.handleLiteral(node);
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

  private handleBlock(node: TreeNode): ICompoundStatement | undefined {
    return {
      nodeType: ASTNodeTypes.CompoundStatement,
      id: Number(node.id) || -999,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    };
  }

  private handleCall(node: TreeNode): CallReturnTypes {
    const properties = node.properties as unknown as CallVertexProperties;

    if (!this.callCollection.includes(node.name)) {
      this.callCollection.push(node.name);
    }

    if (node.name.startsWith("<operator>.")) {
      return this.handleCallOperators(node);
    }

    if (STANDARD_LIB_CALLS.has(node.name)) {
      return {
        nodeType: ASTNodeTypes.StandardLibCall,
        id: Number(node.id) || -999,
        name: node.name,
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }
    return {
      nodeType: ASTNodeTypes.UserDefinedCall,
      id: Number(node.id) || -999,
      name: node.name,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    };
  }

  private handleCallOperators(node: TreeNode): CallOperatorsReturnTypes {
    const properties = node.properties as unknown as CallVertexProperties;

    if (Object.keys(BinaryExpressionOperatorMap).includes(node.name)) {
      return {
        nodeType: ASTNodeTypes.BinaryExpression,
        id: Number(node.id) || -999,
        operator: BinaryExpressionOperatorMap[node.name],
        type: node.code,
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (Object.keys(UnaryExpressionOperatorMap).includes(node.name)) {
      return {
        nodeType: ASTNodeTypes.UnaryExpression,
        id: Number(node.id) || -999,
        operator: node.code,
        type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (node.name === "<operator>.cast") {
      return {
        nodeType: ASTNodeTypes.CastExpression,
        id: Number(node.id) || -999,
        targetType: node.code, // TODO:  This should be the type of the cast, not the code.
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (node.name === "<operator>.fieldAccess" || node.name === "<operator>.indirectFieldAccess") {
      return {
        nodeType: ASTNodeTypes.MemberAccess,
        id: Number(node.id) || -999,
        type: node.code, // TODO: This should be the type of the member access, not the code.
      };
    }

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

    if (node.name === "<operator>.sizeOf") {
      return {
        nodeType: ASTNodeTypes.SizeOfExpression,
        id: Number(node.id) || -999,
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    if (node.name === "<operator>.indirectIndexAccess") {
      return {
        nodeType: ASTNodeTypes.ArraySubscriptionExpression,
        id: Number(node.id) || -999,
        children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
      };
    }

    // TODO: Change to undefined after development, temopral fix to handle childen that does not match the label yet.
    return {
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IAssignmentExpression;
  }

  private handleControlStructure(node: TreeNode): IIfStatement | undefined {
    const properties = node.properties as unknown as ControlStructureVertexProperties;

    if (properties.CONTROL_STRUCTURE_TYPE["@value"]["@value"][0] === "IF") {
      if (node.children.length < 2) {
        throw new Error(`Control structure node ${node.id} has ${node.children.length.toString()} children, expected at least 2.`);
      }

      const conditionChild = this.dispatchConvert(node.children[0]);
      const ifTrueChild = this.dispatchConvert(node.children[1]);
      // Unpack the children of the else branch
      // else node starts with "else" control structure, we do not need the wrapping control structure node.
      const elseBranch = node.children[2] ? this.dispatchConvert(node.children[2]) : undefined;
      const elseChild = elseBranch && Array.isArray(elseBranch.children) ? elseBranch.children[0] : undefined;

      const restructuredChildren = [];

      if (conditionChild) restructuredChildren.push(conditionChild);
      if (ifTrueChild) restructuredChildren.push(ifTrueChild);
      if (elseChild) restructuredChildren.push(elseChild);

      if (conditionChild)
        return {
          nodeType: ASTNodeTypes.IfStatement,
          id: Number(node.id) || -999,
          children: restructuredChildren,
        };
    }

    // TODO: Change to undefined after development, temoporal fix to handle childen that does not match the label yet.
    return {
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IIfStatement;
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

  private handleIdentifier(node: TreeNode): IIdentifier | undefined {
    const properties = node.properties as unknown as IdentifierVertexProperties;
    return {
      nodeType: ASTNodeTypes.Identifier,
      id: Number(node.id) || -999,
      name: node.name,
      size: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"), // TODO: For now, using TYPE_FULL_NAME as size, this should be changed to a proper size property if available.
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    };
  }

  private handleImport(node: TreeNode): undefined {
    return undefined;
  }

  private handleLiteral(node: TreeNode): ILiteral | undefined {
    const properties = node.properties as unknown as LiteralVertexProperties;
    if (node.children.length !== 0) {
      throw new Error(`Literal node ${node.id} has ${node.children.length.toString()} children, expected 0.`);
    }

    return {
      nodeType: ASTNodeTypes.Literal,
      id: Number(node.id) || -999,
      value: node.code,
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
    };

    return undefined;
  }

  private handleLocal(node: TreeNode): IArrayDeclaration | IPointerDeclaration | IVariableDeclaration {
    const properties = node.properties as unknown as LocalVertexProperties;

    if (properties.TYPE_FULL_NAME["@value"]["@value"].length > 0) {
      const typeFullName = properties.TYPE_FULL_NAME["@value"]["@value"].join("/");
      // ArrayDeclaration is a special case of VariableDeclaration
      // Checks type full name has [ and ], and if so, it is an array declaration.
      // Inside of [] is the size of the array and in front of [] is the type of the array.
      if (typeFullName.includes("[") && typeFullName.includes("]")) {
        const elementType = typeFullName.split("[")[0];
        const length = Number(typeFullName.split("[")[1].split("]")[0]);

        return {
          nodeType: ASTNodeTypes.ArrayDeclaration,
          id: Number(node.id) || -999,
          name: node.name,
          elementType,
          length,
          children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
        };
      }

      // PointerDeclaration is a special case of VariableDeclaration
      // Checks type full name has *, and if so, it is an pointer declaration.
      // level depends on the number of * in the type full name.
      // points_to is the type of the pointer.
      if (typeFullName.includes("*")) {
        const level = typeFullName.split("*").length - 1;
        const pointsTo = typeFullName.split("*").slice(-1)[0];

        return {
          nodeType: ASTNodeTypes.PointerDeclaration,
          id: Number(node.id) || -999,
          name: node.name,
          pointingType: pointsTo,
          level,
          children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
        };
      }
    }

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
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IFunctionDeclaration;
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
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as ASTNodes;
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
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IStructType;
  }
}

function assertNever(x: unknown): never {
  throw new Error("Unexpected label: " + JSON.stringify(x));
}
