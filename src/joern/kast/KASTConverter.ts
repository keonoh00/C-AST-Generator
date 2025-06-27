import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ICompoundStatement } from "@/types/Block/CompoundStatement";
import { IBreakStatement } from "@/types/ControlStructures/BreakStatement";
import { IDoWhileStatement } from "@/types/ControlStructures/DoWhileStatement";
import { IForStatement } from "@/types/ControlStructures/ForStatement";
import { IGotoStatement } from "@/types/ControlStructures/GotoStatement";
import { IIfStatement } from "@/types/ControlStructures/IfStatement";
import { ILabel } from "@/types/ControlStructures/Label";
import { ISwitchCase } from "@/types/ControlStructures/SwitchCase";
import { ISwitchStatement } from "@/types/ControlStructures/SwitchStatement";
import { IWhileStatement } from "@/types/ControlStructures/WhileStatement";
import { IStructType } from "@/types/DataTypes/StructType";
import { ITypeDefinition } from "@/types/DataTypes/TypeDefinition";
import { IUnionType } from "@/types/DataTypes/UnionType";
import { IAddressOfExpression } from "@/types/Expressions/AddressOfExpression";
import { IArraySizeAllocation } from "@/types/Expressions/ArraySizeAllocation";
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
  ImportVertexProperties,
  JumpTargetVertexProperties,
  LiteralVertexProperties,
  LocalVertexProperties,
  MemberVertexProperties,
  MethodParameterInVertexProperties,
  MethodVertexProperties,
  TreeNode,
  TypeDeclVertexProperties,
} from "@/types/joern";
import { ASTNodes } from "@/types/node";
import { IIncludeDirective } from "@/types/PreprocessorDirectives/IncludeDirective";
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
  | IAddressOfExpression
  | IArraySizeAllocation
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

  private assertNever(x: unknown): never {
    throw new Error("Unexpected label: " + JSON.stringify(x));
  }

  private convertedChildren(children: TreeNode[]): ASTNodes[] {
    return children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined);
  }

  /**
   * Dispatch helper: switch on node.label, extract payload, call the correct handler.
   * Returns ResultMap[...] or undefined.
   */
  private dispatchConvert(node: TreeNode): ASTNodes | undefined {
    try {
      switch (node.label) {
        case "BINDING":
        case "DEPENDENCY":
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
        case "UNKNOWN":
          return this.handleSkippedNodes(node);
        case "BLOCK":
          return this.handleBlock(node);
        case "CALL":
          return this.handleCall(node);
        case "CONTROL_STRUCTURE":
          return this.handleControlStructure(node);
        case "FIELD_IDENTIFIER": // Handle together
          return this.handleFieldIdentifier(node);
        case "FILE":
          return this.handleFile(node);
        case "IDENTIFIER":
          return this.handleIdentifier(node);
        case "IMPORT":
          return this.handleImport(node);
        case "JUMP_TARGET":
          return this.handleJumpTarget(node);
        case "LITERAL":
          return this.handleLiteral(node);
        case "LOCAL":
          return this.handleLocal(node);
        case "MEMBER":
          return this.handleMember(node);
        case "METHOD":
          return this.handleMethod(node);
        case "METHOD_PARAMETER_IN":
          return this.handleMethodParamIn(node);
        case "TYPE_DECL":
          return this.handleTypeDecl(node);
        default:
          return this.assertNever(node.label);
      }
    } catch (error) {
      console.error(`Error converting node with id ${node.id} and label ${node.label}:`, error);
      throw error; // Re-throw the error after logging it.
    }
  }

  private handleBlock(node: TreeNode): ICompoundStatement | undefined {
    return {
      nodeType: ASTNodeTypes.CompoundStatement,
      id: Number(node.id) || -999,
      children: this.convertedChildren(node.children),
    };
  }

  private handleCall(node: TreeNode): CallReturnTypes {
    if (!this.callCollection.includes(node.name)) {
      this.callCollection.push(node.name);
    }

    if (node.name.startsWith("<operator>.")) {
      return this.handleCallOperators(node);
    }

    const paramListWrapper: IParameterList = {
      nodeType: ASTNodeTypes.ParameterList,
      id: Number(node.id) || -999,
      children: this.convertedChildren(node.children),
    };

    return {
      nodeType: STANDARD_LIB_CALLS.has(node.name) ? ASTNodeTypes.StandardLibCall : ASTNodeTypes.UserDefinedCall,
      id: Number(node.id) || -999,
      name: node.name,
      children: [paramListWrapper],
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
        children: this.convertedChildren(node.children),
      };
    }

    if (Object.keys(UnaryExpressionOperatorMap).includes(node.name)) {
      return {
        nodeType: ASTNodeTypes.UnaryExpression,
        id: Number(node.id) || -999,
        operator: UnaryExpressionOperatorMap[node.name],
        type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
        children: this.convertedChildren(node.children),
      };
    }

    switch (node.name) {
      case "<operator>.addressOf": {
        return {
          nodeType: ASTNodeTypes.AddressOfExpression,
          id: Number(node.id) || -999,
          rhs: node.code.split("&")[1] || node.code,
          children: this.convertedChildren(node.children),
        };
      }
      case "<operator>.assignment": {
        if (node.children.length !== 2) {
          throw new Error(`Call node ${node.id} has ${node.children.length.toString()} children, expected 2.`);
        }
        const allocChild = node.children.filter((child) => child.name === "<operator>.alloc");

        if (allocChild.length === 1) {
          const typeFullName = properties.TYPE_FULL_NAME["@value"]["@value"].join("/");
          const fullRawType = typeFullName.split("[")[1].split("]")[0];
          const length = Number(fullRawType) || fullRawType;

          return {
            nodeType: ASTNodeTypes.ArraySizeAllocation,
            id: Number(node.id) || -999,
            length,
            children: this.convertedChildren(node.children),
          };
        }

        return {
          nodeType: ASTNodeTypes.AssignmentExpression,
          id: Number(node.id) || -999,
          operator: "=",
          children: this.convertedChildren(node.children),
        };
      }
      case "<operator>.cast": {
        const filteredCastingType = node.code.split(")")[0].split("(")[1]; // eg. "(char *)ALLOCA((10)*sizeof(char))"w
        return {
          nodeType: ASTNodeTypes.CastExpression,
          id: Number(node.id) || -999,
          targetType: filteredCastingType || node.code, // TODO:  This should be the type of the cast, not the code.
          children: this.convertedChildren(node.children.filter((child) => child.label !== "TYPE_REF")), // TODO: Force removal of TYPE_REF children, as they are not needed in the cast expression.
        };
      }
      case "<operator>.fieldAccess":
      case "<operator>.indirectFieldAccess": {
        return {
          nodeType: ASTNodeTypes.MemberAccess,
          id: Number(node.id) || -999,
          type: node.code, // TODO: This should be the type of the member access, not the code.
          children: this.convertedChildren(node.children),
        };
      }
      case "<operator>.indirectIndexAccess": {
        return {
          nodeType: ASTNodeTypes.ArraySubscriptionExpression,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
      case "<operator>.sizeOf": {
        return {
          nodeType: ASTNodeTypes.SizeOfExpression,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
    }

    // TODO: Change to undefined after development, temopral fix to handle childen that does not match the label yet.
    return {
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IAssignmentExpression;
  }

  private handleControlStructure(
    node: TreeNode
  ): IBreakStatement | IDoWhileStatement | IForStatement | IGotoStatement | IIfStatement | ISwitchStatement | IWhileStatement | undefined {
    const properties = node.properties as unknown as ControlStructureVertexProperties;

    const controlStructureType = properties.CONTROL_STRUCTURE_TYPE["@value"]["@value"][0];

    switch (controlStructureType) {
      case "BREAK": {
        return {
          nodeType: ASTNodeTypes.BreakStatement,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
      case "DO": {
        return {
          nodeType: ASTNodeTypes.DoWhileStatement,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
      case "FOR": {
        return {
          nodeType: ASTNodeTypes.ForStatement,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
      case "GOTO": {
        return {
          nodeType: ASTNodeTypes.GotoStatement,
          id: Number(node.id) || -999,
          jumpTarget: node.code.split("goto ")[1].replace(";", "") || node.code, // Extract the jump target from the code.
          children: this.convertedChildren(node.children),
        };
      }
      case "IF": {
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

        return {
          nodeType: ASTNodeTypes.IfStatement,
          id: Number(node.id) || -999,
          children: restructuredChildren,
        };
      }
      case "SWITCH": {
        return {
          nodeType: ASTNodeTypes.SwitchStatement,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
      case "WHILE": {
        return {
          nodeType: ASTNodeTypes.DoWhileStatement,
          id: Number(node.id) || -999,
          children: this.convertedChildren(node.children),
        };
      }
    }

    // TODO: Change to undefined after development, temoporal fix to handle childen that does not match the label yet.
    return {
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IIfStatement;
  }

  private handleFieldIdentifier(node: TreeNode): IIdentifier | undefined {
    return {
      nodeType: ASTNodeTypes.Identifier,
      id: Number(node.id) || -999,
      name: node.name || node.code, // Use node.name if available, otherwise use node.code.
      size: "<unknown>", // TODO: For now, using "<unknown>" as size, this should be changed to a proper size property if available.
      type: "<unknown>", // TODO: For now, using "<unknown>" as type, this should be changed to a proper size property if available.
      children: this.convertedChildren(node.children),
    };
  }

  private handleFile(node: TreeNode): ITranslationUnit | undefined {
    if (node.name.endsWith(".c") || node.name.endsWith(".cpp")) {
      return {
        nodeType: ASTNodeTypes.TranslationUnit,
        id: Number(node.id) || -999,
        children: this.convertedChildren(node.children),
      };
    }

    return undefined;
  }

  private handleIdentifier(node: TreeNode): IIdentifier | undefined {
    const properties = node.properties as unknown as IdentifierVertexProperties;
    const typeFullName = properties.TYPE_FULL_NAME["@value"]["@value"].join("/") || "";
    const size = typeFullName.includes("[") && typeFullName.includes("]") ? typeFullName.split("[")[1].split("]")[0] : "<unknown>";
    const type = typeFullName.includes("[") && typeFullName.includes("]") ? typeFullName.split("[")[0] : typeFullName;
    return {
      nodeType: ASTNodeTypes.Identifier,
      id: Number(node.id) || -999,
      name: node.name,
      size,
      type,
      children: this.convertedChildren(node.children),
    };
  }

  private handleImport(node: TreeNode): IIncludeDirective {
    const properties = node.properties as unknown as ImportVertexProperties;
    return {
      nodeType: ASTNodeTypes.IncludeDirective,
      id: Number(node.id) || -999,
      name: properties.IMPORTED_AS["@value"]["@value"].join("/"),
      children: this.convertedChildren(node.children),
    };
  }

  private handleJumpTarget(node: TreeNode): ILabel | ISwitchCase | undefined {
    const properties = node.properties as unknown as JumpTargetVertexProperties;
    if (node.name === "case") {
      return {
        nodeType: ASTNodeTypes.SwitchCase,
        id: Number(node.id) || -999,
        children: this.convertedChildren(node.children),
      };
    }

    return {
      nodeType: ASTNodeTypes.Label,
      id: Number(node.id) || -999,
      name: properties.NAME["@value"]["@value"].join("/"),
      children: this.convertedChildren(node.children),
    };
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
        const fullRawType = typeFullName.split("[")[1].split("]")[0];
        const length = Number(fullRawType) || fullRawType;

        return {
          nodeType: ASTNodeTypes.ArrayDeclaration,
          id: Number(node.id) || -999,
          name: node.name,
          elementType,
          length,
          children: this.convertedChildren(node.children),
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
          children: this.convertedChildren(node.children),
        };
      }
    }

    return {
      nodeType: ASTNodeTypes.VariableDeclaration,
      id: Number(node.id) || -999,
      name: node.name,
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
      children: this.convertedChildren(node.children),
    };
  }

  private handleMember(node: TreeNode): IArrayDeclaration | IPointerDeclaration | IVariableDeclaration {
    const properties = node.properties as unknown as MemberVertexProperties;

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
          children: this.convertedChildren(node.children),
        };
      }

      // PointerDeclaration is a special case of VariableDeclaration
      // Checks type full name has *, and if so, it is an pointer declaration.
      // level depends on the number of * in the type full name.
      // points_to is the type of the pointer.
      if (typeFullName.includes("*")) {
        const level = typeFullName.split("*").length - 1;
        const pointsTo = typeFullName.split("*").slice(-1)[0] || "void";

        return {
          nodeType: ASTNodeTypes.PointerDeclaration,
          id: Number(node.id) || -999,
          name: node.name,
          pointingType: pointsTo,
          level,
          children: this.convertedChildren(node.children),
        };
      }
    }

    return {
      nodeType: ASTNodeTypes.VariableDeclaration,
      id: Number(node.id) || -999,
      name: node.name,
      type: properties.TYPE_FULL_NAME["@value"]["@value"].join("/"),
      children: this.convertedChildren(node.children),
    };
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
      if ((paramList.children ?? []).length === 0) {
        paramList.children = [
          {
            nodeType: ASTNodeTypes.ParameterDeclaration,
            id: -999,
            name: "<empty>",
            type: "<empty>",
            children: [],
          },
        ];
      }
      const nonFuncParamChildren = node.children
        .filter((child) => child.label !== "METHOD_PARAMETER_IN")
        .filter((child) => !["METHOD_RETURN", "MODIFIER"].includes(child.label)) // TODO: currently skipping METHOD_RETURN and MODIFIER children, as they are not needed in the function declaration.
        .map((child) => this.dispatchConvert(child))
        .filter((child): child is ASTNodes => child !== undefined);

      return {
        nodeType: firstBlock && firstBlock.code === "<empty>" ? ASTNodeTypes.FunctionDeclaration : ASTNodeTypes.FunctionDefinition,
        id: Number(node.id) || -999,
        name: node.name,
        returnType: properties.SIGNATURE["@value"]["@value"].join("/"),
        children: [paramList, ...nonFuncParamChildren],
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
      children: this.convertedChildren(node.children),
    };
  }

  private handleSkippedNodes(node: TreeNode): ASTNodes | undefined {
    return {
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as ASTNodes;
  }

  private handleTypeDecl(node: TreeNode): IStructType | ITypeDefinition | IUnionType | undefined {
    const properties = node.properties as unknown as TypeDeclVertexProperties;

    if (node.code.includes("typedef struct")) {
      return {
        nodeType: ASTNodeTypes.StructType,
        id: Number(node.id) || -999,
        name: node.name,
        children: this.convertedChildren(node.children.filter((child) => child.label !== "METHOD" && child.name !== "<clinit>")), // TODO: Force removal of METHOD children, as they are not needed in the struct type.
      };
    }

    if (node.code.includes("typedef union")) {
      return {
        nodeType: ASTNodeTypes.UnionType,
        id: Number(node.id) || -999,
        name: node.name,
        children: this.convertedChildren(node.children),
      };
    }

    if (node.code.includes("typedef")) {
      return {
        nodeType: ASTNodeTypes.TypeDefinition,
        id: Number(node.id) || -999,
        name: node.name,
        underlyingType: properties.ALIAS_TYPE_FULL_NAME ? properties.ALIAS_TYPE_FULL_NAME["@value"]["@value"].join("/") : "<unknown>",
        children: this.convertedChildren(node.children),
      };
    }

    // TODO: Change to undefined after development, temoporal fix to handle childen that does not match the label yet.
    return {
      ...node,
      children: node.children.map((child) => this.dispatchConvert(child)).filter((child): child is ASTNodes => child !== undefined),
    } as unknown as IStructType;
  }
}
