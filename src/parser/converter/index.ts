/* eslint-disable @typescript-eslint/no-unused-vars */

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ICompoundStatement } from "@/types/Block/CompoundStatement";
import { IBreakStatement } from "@/types/ControlStructures/BreakStatement";
import { IDoWhileStatement } from "@/types/ControlStructures/DoWhileStatement";
import { IForStatement } from "@/types/ControlStructures/ForStatement";
import { IGotoStatement } from "@/types/ControlStructures/GotoStatement";
import { IIfStatement } from "@/types/ControlStructures/IfStatement";
import { ILabel } from "@/types/ControlStructures/Label";
import { IReturnStatement } from "@/types/ControlStructures/ReturnStatement";
import { ISwitchCase } from "@/types/ControlStructures/SwitchCase";
import { ISwitchStatement } from "@/types/ControlStructures/SwitchStatement";
import { IStructType } from "@/types/DataTypes/StructType";
import { ITypeDefinition } from "@/types/DataTypes/TypeDefinition";
import { IUnionType } from "@/types/DataTypes/UnionType";
import { IArraySubscriptionExpression } from "@/types/Expressions/ArraySubscriptExpression";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { IBinaryExpression } from "@/types/Expressions/BinaryExpression";
import { ICastExpression } from "@/types/Expressions/CastExpression";
import { IIdentifier } from "@/types/Expressions/Identifier";
import { IMemberAccess } from "@/types/Expressions/MemberAccess";
import { IUnarayExpression } from "@/types/Expressions/UnaryExpression";
import { ASTNodes } from "@/types/node";
import { IArrayDeclaration } from "@/types/ProgramStructures/ArrayDeclaration";
import { IFunctionDeclaration } from "@/types/ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "@/types/ProgramStructures/FunctionDefinition";
import { IPointerDeclaration } from "@/types/ProgramStructures/PointerDeclaration";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import {
  IParserArrayDeclNode,
  IParserAssignmentNode,
  IParserBinaryOpNode,
  IParserBreakNode,
  IParserCaseNode,
  IParserCastNode,
  IParserCompoundNode,
  IParserDefaultNode,
  IParserDoWhileNode,
  IParserFileASTNode,
  IParserForNode,
  IParserFuncDeclNode,
  IParserFuncDefNode,
  IParserGotoNode,
  IParserIDNode,
  IParserIfNode,
  IParserLabelNode,
  IParserPtrDeclNode,
  IParserReturnNode,
  IParserStructNode,
  IParserStructRefNode,
  IParserSwitchNode,
  IParserTypedefNode,
  IParserUnaryOpNode,
  IParserUnionNode,
  KindToNodeMap,
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

  private convertArrayDecl(parserNode: IParserArrayDeclNode): IArrayDeclaration {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDecl = children.find((c) => c.kind === ParserKind.TypeDecl);

    const constNode = children.find((c) => c.kind === ParserKind.Constant);

    if (!typeDecl || !constNode) {
      throw new Error(`No typeDecl or constNode in ArrayDecl: ${JSON.stringify(parserNode)}`);
    }

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

  private convertCast(parserNode: IParserCastNode): ICastExpression {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDeclNode = this.findParserNodeWithType(parserNode, ParserKind.TypeDecl);

    if (!typeDeclNode) {
      throw new Error(`Missing TypeDecl Node in Cast: ${JSON.stringify(parserNode)}`);
    }

    const typeDeclIdentifier = this.findParserNodeWithType(typeDeclNode, ParserKind.IdentifierType);

    if (!typeDeclIdentifier?.names) {
      throw new Error(`Invalid TypeDecl's Identifier in Cast ${JSON.stringify(typeDeclNode)}`);
    }

    const base: ICastExpression = {
      nodeType: ASTNodeTypes.CastExpression,
      targetType: String(typeDeclIdentifier.names),
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertCompound(parserNode: IParserCompoundNode): ICompoundStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: ICompoundStatement = {
      nodeType: ASTNodeTypes.CompoundStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertConstant(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertDecl(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertDefault(parserNode: IParserDefaultNode): ISwitchCase {
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

  private convertDoWhile(parserNode: IParserDoWhileNode): IDoWhileStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IDoWhileStatement = {
      nodeType: ASTNodeTypes.DoWhileStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertExprList(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFileAST(parserNode: IParserFileASTNode): ITranslationUnit {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: ITranslationUnit = {
      nodeType: ASTNodeTypes.TranslationUnit,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertFor(parserNode: IParserForNode): IForStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IForStatement = {
      nodeType: ASTNodeTypes.ForStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertFuncCall(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertFuncDecl(parserNode: IParserFuncDeclNode): IFunctionDeclaration {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDeclNode = this.findParserNodeWithType(parserNode, ParserKind.TypeDecl);

    if (!typeDeclNode) {
      throw new Error(`Missing TypeDecl Node in FuncDecl: ${JSON.stringify(parserNode)}`);
    }

    const typeDeclIdentifier = this.findParserNodeWithType(typeDeclNode, ParserKind.IdentifierType);

    if (!typeDeclIdentifier?.names) {
      throw new Error(`Invalid TypeDecl's Identifier in FuncDecl ${JSON.stringify(typeDeclNode)}`);
    }

    const base: IFunctionDeclaration = {
      name: String(typeDeclNode.declname),
      nodeType: ASTNodeTypes.FunctionDeclaration,
      returnType: String(typeDeclIdentifier.names),
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertFuncDef(parserNode: IParserFuncDefNode): IFunctionDefinition {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];
    const funcDeclNode = this.findParserNodeWithType(parserNode, ParserKind.FuncDecl);

    if (!funcDeclNode) {
      throw new Error(`Missing FuncDecl Node in FuncDef: ${JSON.stringify(parserNode)}`);
    }

    const funcDeclTypeDeclNode = this.findParserNodeWithType(funcDeclNode, ParserKind.TypeDecl);

    if (!funcDeclTypeDeclNode) {
      throw new Error(`Missing FuncDecl-TypeDecl Node in FuncDef: ${JSON.stringify(funcDeclNode)}`);
    }

    const typeDeclIdentifier = this.findParserNodeWithType(funcDeclTypeDeclNode, ParserKind.IdentifierType);

    if (!typeDeclIdentifier?.names) {
      throw new Error(`Invalid FuncDecl-TypeDecl-Identifier in FuncDef ${JSON.stringify(typeDeclIdentifier)}`);
    }

    const base: IFunctionDefinition = {
      name: String(typeDeclIdentifier.declname as string),
      nodeType: ASTNodeTypes.FunctionDefinition,
      returnType: String(typeDeclIdentifier.names),
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertGoto(parserNode: IParserGotoNode): IGotoStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IGotoStatement = {
      jumpTarget: String(parserNode.name),
      nodeType: ASTNodeTypes.GotoStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertID(parserNode: IParserIDNode): IIdentifier {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDeclNode = this.findParserNodeWithType(parserNode, ParserKind.TypeDecl);

    if (!typeDeclNode) {
      throw new Error(`Missing TypeDecl Node in ID: ${JSON.stringify(parserNode)}`);
    }

    const typeDeclIdentifier = this.findParserNodeWithType(typeDeclNode, ParserKind.IdentifierType);

    if (!typeDeclIdentifier?.names) {
      throw new Error(`Invalid TypeDecl-Identifier in ID ${JSON.stringify(typeDeclNode)}`);
    }

    const base: IIdentifier = {
      name: String(parserNode.name),
      nodeType: ASTNodeTypes.Identifier,
      size: "undefined", // TODO: Figure out
      type: String(typeDeclIdentifier.names),
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertIdentifierType(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertIf(parserNode: IParserIfNode): IIfStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IIfStatement = {
      nodeType: ASTNodeTypes.IfStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertLabel(parserNode: IParserLabelNode): ILabel {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: ILabel = {
      name: String(parserNode.name),
      nodeType: ASTNodeTypes.Label,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertPtrDecl(parserNode: IParserPtrDeclNode): IPointerDeclaration {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDecl = children.find((c) => c.kind === ParserKind.TypeDecl);

    if (!typeDecl) {
      throw new Error(`No typeDecl in PtrDecl: ${JSON.stringify(parserNode)}`);
    }

    const typeDeclChildren = Array.isArray(typeDecl.children) ? (typeDecl.children as ParserASTNode[]) : [];

    const identifierType = typeDeclChildren.find((c) => c.kind === ParserKind.IdentifierType);

    const name: string = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
    const type: string = Array.isArray(identifierType?.names) ? identifierType.names.join(" ") : "";

    const base: IPointerDeclaration = {
      level: 0, // TODO: Figure out
      name,
      nodeType: ASTNodeTypes.PointerDeclaration,
      pointsTo: type, // TODO: Figure out
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertReturn(parserNode: IParserReturnNode): IReturnStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IReturnStatement = {
      nodeType: ASTNodeTypes.ReturnStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
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

  private convertStruct(parserNode: IParserStructNode): IStructType {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IStructType = {
      name: String(parserNode.name),
      nodeType: ASTNodeTypes.StructType,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertStructRef(parserNode: IParserStructRefNode): IMemberAccess {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IMemberAccess = {
      nodeType: ASTNodeTypes.MemberAccess,
      type: "undefined", // TODO: Figure out
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertSwitch(parserNode: IParserSwitchNode): ISwitchStatement {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: ISwitchStatement = {
      nodeType: ASTNodeTypes.SwitchStatement,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertTernaryOp(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertTypeDecl(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertTypedef(parserNode: IParserTypedefNode): ITypeDefinition {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const typeDecl = children.find((c) => c.kind === ParserKind.TypeDecl);

    if (!typeDecl) {
      throw new Error(`No typeDecl in Typedef: ${JSON.stringify(parserNode)}`);
    }

    if (!typeDecl.children) {
      throw new Error(`No typeDecl children in Typedef: ${JSON.stringify(parserNode)}`);
    }

    const base: ITypeDefinition = {
      name: String(parserNode.name),
      nodeType: ASTNodeTypes.TypeDefinition,
      underlyingType: typeDecl.children.kind,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertTypename(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private convertUnaryOp(parserNode: IParserUnaryOpNode): IUnarayExpression {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    if (children.length !== 2) {
      throw new Error(`Invalid Children Number for UnaryOp ${JSON.stringify(parserNode)}`);
    }

    const typeDecl = children.find((c) => c.kind === ParserKind.TypeDecl);

    if (!typeDecl) {
      throw new Error(`No typeDecl in UnaryOp: ${JSON.stringify(parserNode)}`);
    }

    const typeDeclChildren = Array.isArray(typeDecl.children) ? (typeDecl.children as ParserASTNode[]) : [];

    const identifierType = typeDeclChildren.find((c) => c.kind === ParserKind.IdentifierType);

    const type: string = Array.isArray(identifierType?.names) ? identifierType.names.join(" ") : "";

    const base: IUnarayExpression = {
      nodeType: ASTNodeTypes.UnarayExpression,
      operator: parserNode.op as string,
      type,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertUnion(parserNode: IParserUnionNode): IUnionType {
    const children = Array.isArray(parserNode.children) ? (parserNode.children as ParserASTNode[]) : [];

    const base: IUnionType = {
      name: String(parserNode.name),
      nodeType: ASTNodeTypes.UnionType,
    };

    const convertedChildren = this.convertCParserNodes(children);
    if (convertedChildren.length > 0) {
      base.children = convertedChildren;
    }

    return base;
  }

  private convertWhile(parserNode: ParserASTNode): ASTNodes | undefined {
    return undefined;
  }

  private findParserNodeWithType<K extends ParserKind>(node: ParserASTNode, kind: K): KindToNodeMap[K] | undefined {
    if (node.kind === kind) return node as KindToNodeMap[K];

    if (Array.isArray(node.children)) {
      for (const child of node.children as ParserASTNode[]) {
        if (this.findParserNodeWithType(child, kind)) return child as KindToNodeMap[K];
      }
    }

    return undefined;
  }
}
