/* eslint-disable @typescript-eslint/no-unused-vars */

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { IBreakStatement } from "@/types/ControlStructures/BreakStatement";
import { ISwitchCase } from "@/types/ControlStructures/SwitchCase";
import { IArraySubscriptionExpression } from "@/types/Expressions/ArraySubscriptExpression";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { IBinaryExpression } from "@/types/Expressions/BinaryExpression";
import { ASTNodes } from "@/types/node";
import { IArrayDeclaration } from "@/types/ProgramStructures/ArrayDeclaration";
import {
  IParserArrayDeclNode,
  IParserAssignmentNode,
  IParserBinaryOpNode,
  IParserBreakNode,
  IParserCaseNode,
  ParserASTNode,
  ParserKind,
} from "@/types/PyCParser/pycparser";

export class CParserNodeConverter {
  public convertCParserNodes(parserNodes: ParserASTNode[]): ASTNodes[] {
    const converted: ASTNodes[] = [];
    for (const parserNode of parserNodes) {
      const node = this.convertSingleNode(parserNode);
      if (node) {
        converted.push(node);
      }
    }
    return converted;
  }

  private convertArrayDecl(parserNode: IParserArrayDeclNode): IArrayDeclaration | undefined {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDecl = children.find((c) => c.kind === ParserKind.TypeDecl);

    const constNode = children.find((c) => c.kind === ParserKind.Constant);

    if (!typeDecl || !constNode) return undefined;

    const typeDeclChildren = Array.isArray(typeDecl.children) ? (typeDecl.children as ParserASTNode[]) : [];

    const identifierType = typeDeclChildren.find((c) => c.kind === ParserKind.IdentifierType);

    const name: string = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
    const elementType: string = Array.isArray(identifierType?.names) ? identifierType.names.join(" ") : "";
    const rawLength = constNode.value;
    const length: number = typeof rawLength === "string" && /^\d+$/.test(rawLength) ? parseInt(rawLength, 10) : 0;

    const base: IArrayDeclaration = {
      elementType,
      length,
      name,
      nodeType: ASTNodeTypes.ArrayDeclaration,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertArrayRef(parserNode: ParserASTNode): IArraySubscriptionExpression {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IArraySubscriptionExpression = {
      nodeType: ASTNodeTypes.ArraySubscriptionExpression,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertAssignment(parserNode: IParserAssignmentNode): IAssignmentExpression {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IAssignmentExpression = {
      nodeType: ASTNodeTypes.AssignmentExpression,
      operator: parserNode.op as string,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertBinaryOp(parserNode: IParserBinaryOpNode): IBinaryExpression {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    if (children.length !== 2) {
      throw new Error(`Invalid Children Number for BinaryOp ${JSON.stringify(parserNode)}`);
    }

    const typeLeft: string = (children[0].type as string) || children[0].kind;
    const typeRight: string = (children[1].type as string) || children[1].kind;

    const base: IBinaryExpression = {
      nodeType: ASTNodeTypes.BinaryExpression,
      operator: parserNode.op as string,
      type: typeLeft + "/" + typeRight,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertBreak(parserNode: IParserBreakNode): IBreakStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IBreakStatement = {
      nodeType: ASTNodeTypes.BreakStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertCase(parserNode: IParserCaseNode): ISwitchCase {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: ISwitchCase = {
      nodeType: ASTNodeTypes.SwitchCase,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertCast(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertCompound(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertConstant(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertDecl(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertDefault(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertDoWhile(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertExprList(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFileAST(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFor(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFuncCall(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFuncDecl(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFuncDef(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertGoto(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertID(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertIdentifierType(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertIf(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertLabel(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertPtrDecl(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertReturn(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertSingleNode(parserNode: ParserASTNode): ASTNodes | undefined {
    const kind = parserNode.kind;

    if (!Object.values(ParserKind).includes(parserNode.kind)) {
      console.error(`[RawNodeConverter] Unknown ParserKind: ${parserNode.kind}`);
      return undefined;
    }

    switch (parserNode.kind) {
      case ParserKind.Alignas:
        return this.convertWhile(parserNode);
      case ParserKind.ArrayDecl:
        return this.convertArrayDecl(parserNode);
      case ParserKind.ArrayRef: {
        this.convertArrayRef(parserNode);
        return;
      }
      case ParserKind.Assignment:
        return this.convertAssignment(parserNode);
      case ParserKind.BinaryOp:
        return this.convertBinaryOp(parserNode);
      case ParserKind.Break:
        return this.convertBreak(parserNode);
      case ParserKind.Case:
        return this.convertCase(parserNode);
      case ParserKind.Cast:
        return this.convertCast(parserNode);
      case ParserKind.Compound:
        return this.convertCompound(parserNode);
      case ParserKind.CompoundLiteral:
        return this.convertWhile(parserNode);
      case ParserKind.Constant:
        return this.convertConstant(parserNode);
      case ParserKind.Continue:
        return this.convertWhile(parserNode);
      case ParserKind.Decl:
        return this.convertDecl(parserNode);
      case ParserKind.DeclList:
        return this.convertWhile(parserNode);
      case ParserKind.Default:
        return this.convertDefault(parserNode);
      case ParserKind.DoWhile:
        return this.convertDoWhile(parserNode);
      case ParserKind.EllipsisParam:
        return this.convertWhile(parserNode);
      case ParserKind.EmptyStatement:
        return this.convertWhile(parserNode);
      case ParserKind.Enum:
        return this.convertWhile(parserNode);
      case ParserKind.Enumerator:
        return this.convertWhile(parserNode);
      case ParserKind.EnumeratorList:
        return this.convertWhile(parserNode);
      case ParserKind.ExprList:
        return this.convertExprList(parserNode);
      case ParserKind.FileAST:
        return this.convertFileAST(parserNode);
      case ParserKind.For:
        return this.convertFor(parserNode);
      case ParserKind.FuncCall:
        return this.convertFuncCall(parserNode);
      case ParserKind.FuncDecl:
        return this.convertFuncDecl(parserNode);
      case ParserKind.FuncDef:
        return this.convertFuncDef(parserNode);
      case ParserKind.Goto:
        return this.convertGoto(parserNode);
      case ParserKind.ID:
        return this.convertID(parserNode);
      case ParserKind.IdentifierType:
        return this.convertIdentifierType(parserNode);
      case ParserKind.If:
        return this.convertIf(parserNode);
      case ParserKind.InitList:
        return this.convertWhile(parserNode);
      case ParserKind.Label:
        return this.convertLabel(parserNode);
      case ParserKind.NamedInitializer:
        return this.convertWhile(parserNode);
      case ParserKind.ParamList:
        return this.convertWhile(parserNode);
      case ParserKind.Pragma:
        return this.convertWhile(parserNode);
      case ParserKind.PtrDecl:
        return this.convertPtrDecl(parserNode);
      case ParserKind.Return:
        return this.convertReturn(parserNode);
      case ParserKind.StaticAssert:
        return this.convertWhile(parserNode);
      case ParserKind.Struct:
        return this.convertStruct(parserNode);
      case ParserKind.StructRef:
        return this.convertStructRef(parserNode);
      case ParserKind.Switch:
        return this.convertSwitch(parserNode);
      case ParserKind.TernaryOp:
        return this.convertTernaryOp(parserNode);
      case ParserKind.TypeDecl:
        return this.convertTypeDecl(parserNode);
      case ParserKind.Typedef:
        return this.convertTypedef(parserNode);
      case ParserKind.Typename:
        return this.convertTypename(parserNode);
      case ParserKind.UnaryOp:
        return this.convertUnaryOp(parserNode);
      case ParserKind.Union:
        return this.convertUnion(parserNode);
      case ParserKind.While:
        return this.convertWhile(parserNode);

      default: {
        const _exhaustiveCheck: never = kind as never;
        return undefined;
      }
    }
  }

  private convertStruct(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertStructRef(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertSwitch(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertTernaryOp(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertTypeDecl(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertTypedef(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertTypename(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertUnaryOp(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertUnion(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertWhile(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }
}
