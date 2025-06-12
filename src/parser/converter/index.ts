// src/parser/converter/index.ts

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ICompoundStatement } from "@/types/Block/CompoundStatement";
import { IBreakStatement } from "@/types/ControlStructures/BreakStatement";
import { IContinueStatement } from "@/types/ControlStructures/ContinueStatement";
import { IDoWhileStatement } from "@/types/ControlStructures/DoWhileStatement";
import { IForStatement } from "@/types/ControlStructures/ForStatement";
import { IGotoStatement } from "@/types/ControlStructures/GotoStatement";
import { IIfStatement } from "@/types/ControlStructures/IfStatement";
import { ILabel } from "@/types/ControlStructures/Label";
import { IReturnStatement } from "@/types/ControlStructures/ReturnStatement";
import { ISwitchCase } from "@/types/ControlStructures/SwitchCase";
import { ISwitchStatement } from "@/types/ControlStructures/SwitchStatement";
import { IWhileStatement } from "@/types/ControlStructures/WhileStatement";
import { IStructType } from "@/types/DataTypes/StructType";
import { ITypeDefinition } from "@/types/DataTypes/TypeDefinition";
import { IUnionType } from "@/types/DataTypes/UnionType";
import { IAddressOfExpression } from "@/types/Expressions/AddressOfExpression";
import { IArraySubscriptionExpression } from "@/types/Expressions/ArraySubscriptExpression";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { IBinaryExpression } from "@/types/Expressions/BinaryExpression";
import { ICastExpression } from "@/types/Expressions/CastExpression";
import { IIdentifier } from "@/types/Expressions/Identifier";
import { ILiteral } from "@/types/Expressions/Literal";
import { IMemberAccess } from "@/types/Expressions/MemberAccess";
import { IPointerDereference } from "@/types/Expressions/PointerDereference";
import { ISizeOfExpression } from "@/types/Expressions/SizeOfExpression";
import { IStandardLibCall } from "@/types/Expressions/StandardLibCall";
import { IUnaryExpression } from "@/types/Expressions/UnaryExpression";
import { IUserDefinedCall } from "@/types/Expressions/UserDefinedCall";
import { ASTNodes } from "@/types/node";
import { IArrayDeclaration } from "@/types/ProgramStructures/ArrayDeclaration";
import { IFunctionDeclaration } from "@/types/ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "@/types/ProgramStructures/FunctionDefinition";
import { IParameterDeclaration } from "@/types/ProgramStructures/ParameterDeclaration";
import { IParameterList } from "@/types/ProgramStructures/ParameterList";
import { IPointerDeclaration } from "@/types/ProgramStructures/PointerDeclaration";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import { IVariableDeclaration } from "@/types/ProgramStructures/VariableDeclaration";
import {
  IParserAssignmentNode,
  IParserBinaryOpNode,
  IParserConstantNode,
  IParserDeclNode,
  IParserGotoNode,
  IParserIDNode,
  IParserLabelNode,
  IParserStructNode,
  IParserTypeDeclNode,
  IParserTypedefNode,
  IParserUnaryOpNode,
  IParserUnionNode,
  KindToNodeMap,
  ParserNode,
  ParserNodeKind,
} from "@/types/pycparser";

/**
 * Converts C parser nodes to AST nodes using a switch-case for exhaustiveness
 */
export class CParserNodeConverter {
  private counter: Record<ParserNodeKind, number>;
  private nodeIdCounter = 0;

  constructor() {
    this.counter = Object.values(ParserNodeKind).reduce((acc, kind) => ({ ...acc, [kind]: 0 }), {} as Record<ParserNodeKind, number>);
  }

  /**
   * Convert an array of ParserNodes, filtering out undefined results
   */
  public convertCParserNodes(nodes: ParserNode[], fromParam?: boolean): ASTNodes[] {
    const converted = nodes.map((n) => this.convertSingleNode(n, fromParam)).filter((n): n is ASTNodes => n !== undefined);

    return converted;
  }

  /**
   * Retrieve conversion counts for each ParserNodeKind
   */
  public getConversionCounts(): Record<ParserNodeKind, number> {
    return { ...this.counter };
  }

  private assertNever(x: never): never {
    throw new Error(`Unhandled parser node kind: ${x as string}`);
  }

  /** Decl → IArrayDeclaration */
  private convertArrayDecl(node: ParserNode): IArrayDeclaration {
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    const constNode = this.findParserNodeWithType(node, ParserNodeKind.Constant);
    if (!typeDecl) {
      throw new Error("Missing TypeDecl or Constant in ArrayDecl: " + JSON.stringify(node));
    }
    const name = typeDecl.declname ?? "";
    const elementType = this.findTypeFromTypeDecl(typeDecl);
    const rawLength = constNode?.value;
    const length = rawLength && /^\d+$/.test(rawLength) ? parseInt(rawLength, 10) : 0;
    const base = this.createNodeBase(ASTNodeTypes.ArrayDeclaration, {
      elementType,
      length,
      name,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** ArrayRef → IArraySubscriptionExpression */
  private convertArrayRef(node: ParserNode): IArraySubscriptionExpression {
    const base = this.createNodeBase(ASTNodeTypes.ArraySubscriptionExpression);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Assignment → IAssignmentExpression */
  private convertAssignment(node: ParserNode): IAssignmentExpression {
    const { op } = node as IParserAssignmentNode;
    const base = this.createNodeBase(ASTNodeTypes.AssignmentExpression, {
      operator: op,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** BinaryOp → IBinaryExpression */
  private convertBinaryOp(node: ParserNode): IBinaryExpression {
    const bin = node as IParserBinaryOpNode;
    const kids = Array.isArray(bin.children) ? bin.children : [];
    if (kids.length !== 2) {
      throw new Error("BinaryOp expects 2 children, got " + kids.length.toString());
    }

    const typeDeclLeft = this.findParserNodeWithType(kids[0], ParserNodeKind.TypeDecl);
    const typeDeclRight = this.findParserNodeWithType(kids[1], ParserNodeKind.TypeDecl);

    const typeLeft = this.findTypeFromTypeDecl(typeDeclLeft);
    const typeRight = this.findTypeFromTypeDecl(typeDeclRight);

    const base = this.createNodeBase(ASTNodeTypes.BinaryExpression, {
      operator: bin.op,
      type: `${typeLeft}/${typeRight}`,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Break → IBreakStatement */
  private convertBreak(node: ParserNode): IBreakStatement {
    const base = this.createNodeBase(ASTNodeTypes.BreakStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Case → ISwitchCase */
  private convertCase(node: ParserNode): ISwitchCase {
    const base = this.createNodeBase(ASTNodeTypes.SwitchCase);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Cast → ICastExpression */
  private convertCast(node: ParserNode): ICastExpression {
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (!typeDecl) {
      throw new Error("Missing TypeDecl in Cast: " + JSON.stringify(node));
    }

    const targetType = this.findTypeFromTypeDecl(typeDecl);
    const base = this.createNodeBase(ASTNodeTypes.CastExpression, { targetType });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Compound → ICompoundStatement */
  private convertCompound(node: ParserNode): ICompoundStatement {
    const base = this.createNodeBase(ASTNodeTypes.CompoundStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Constant → ILiteral */
  private convertConstant(node: ParserNode): ILiteral {
    const value = (node as IParserConstantNode).value;
    const type = (node as IParserConstantNode).type;
    const base = this.createNodeBase(ASTNodeTypes.Literal, {
      type,
      value,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Continue → IContinueStatement */
  private convertContinue(node: ParserNode): IContinueStatement {
    const base = this.createNodeBase(ASTNodeTypes.ContinueStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Decl → IVariableDeclaration | IArrayDeclaration | IPointerDeclaration */
  private convertDecl(node: ParserNode): IArrayDeclaration | IPointerDeclaration | IVariableDeclaration {
    // if this Decl is just an ArrayDecl wrapper, peel it off
    const arrChild = node.children?.find((c) => c.kind === ParserNodeKind.ArrayDecl);
    if (arrChild) {
      // take all of node.children **except** the ArrayDecl itself
      const extras = (node.children ?? []).filter((c) => c !== arrChild);
      // prepend any existing ArrayDecl.children
      (arrChild as ParserNode).children = [...(arrChild.children ?? []), ...extras];
      return this.convertArrayDecl(arrChild as ParserNode);
    }

    // same for pointer declarations
    const ptrChild = node.children?.find((c) => c.kind === ParserNodeKind.PtrDecl);
    if (ptrChild) {
      const extras = (node.children ?? []).filter((c) => c !== ptrChild);
      (ptrChild as ParserNode).children = [...(ptrChild.children ?? []), ...extras];
      return this.convertPtrDecl(ptrChild as ParserNode);
    }

    // otherwise a normal variable decl
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (!typeDecl) {
      throw new Error("Missing TypeDecl in Decl: " + JSON.stringify(node));
    }
    const name = (node as IParserDeclNode).name;
    const type = this.findTypeFromTypeDecl(typeDecl);
    const base = this.createNodeBase(ASTNodeTypes.VariableDeclaration, { name, type });
    return this.wrapChildren(base, node, (kids) => this.convertCParserNodes(kids));
  }

  /** Decl → IParameterDeclaration */
  private convertDeclFromParam(node: ParserNode): IParameterDeclaration {
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (!typeDecl) {
      throw new Error("Missing TypeDecl in Decl: " + JSON.stringify(node));
    }

    const name = (node as IParserDeclNode).name;
    const type = this.findTypeFromTypeDecl(typeDecl);
    const base = this.createNodeBase(ASTNodeTypes.ParameterDeclaration, {
      name,
      type,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** DoWhile → IDoWhileStatement */
  private convertDoWhile(node: ParserNode): IDoWhileStatement {
    const base = this.createNodeBase(ASTNodeTypes.DoWhileStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** FileAST → ITranslationUnit */
  private convertFileAST(node: ParserNode): ITranslationUnit {
    const base = this.createNodeBase(ASTNodeTypes.TranslationUnit);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** For → IForStatement */
  private convertFor(node: ParserNode): IForStatement {
    const base = this.createNodeBase(ASTNodeTypes.ForStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** FuncCall → IUserDefinedCall or IStandardLibCall */
  private convertFuncCall(node: ParserNode): IStandardLibCall | IUserDefinedCall {
    const identifierNode = this.findParserNodeWithType(node, ParserNodeKind.ID);
    if (!identifierNode) {
      throw new Error("Missing Identifier in FuncCall: " + JSON.stringify(node));
    }

    const name = identifierNode.name;
    const base = this.createNodeBase((ASTNodeTypes.StandardLibCall + "/" + ASTNodeTypes.UserDefinedCall) as ASTNodeTypes.UserDefinedCall, {
      name,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** FuncDecl → IFunctionDeclaration */
  private convertFuncDecl(node: ParserNode): IFunctionDeclaration {
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (!typeDecl) {
      throw new Error("Missing TypeDecl in FuncDecl: " + JSON.stringify(node));
    }

    const name = typeDecl.declname ?? "";
    const returnType = this.findTypeFromTypeDecl(typeDecl);
    const base = this.createNodeBase(ASTNodeTypes.FunctionDeclaration, {
      name,
      returnType,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** FuncDef → IFunctionDefinition */
  private convertFuncDef(node: ParserNode): IFunctionDefinition {
    const funcDecl = this.findParserNodeWithType(node, ParserNodeKind.FuncDecl);
    if (!funcDecl) {
      throw new Error("Missing FuncDecl in FuncDef: " + JSON.stringify(node));
    }
    const typeDecl = this.findParserNodeWithType(funcDecl, ParserNodeKind.TypeDecl);
    const returnType = this.findTypeFromTypeDecl(typeDecl);

    const functionName = typeDecl?.declname ?? "";
    const base = this.createNodeBase(ASTNodeTypes.FunctionDefinition, {
      name: functionName,
      returnType,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Goto → IGotoStatement */
  private convertGoto(node: ParserNode): IGotoStatement {
    const { name } = node as IParserGotoNode;
    const jumpTarget = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.GotoStatement, { jumpTarget });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** ID → IIdentifier */
  private convertID(node: ParserNode): IIdentifier {
    const { name } = node as IParserIDNode;
    const safeName = name ? name : "";
    const typeDeclNode = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);

    const type = this.findTypeFromTypeDecl(typeDeclNode);
    const base = this.createNodeBase(ASTNodeTypes.Identifier, {
      name: safeName,
      size: "undefined",
      type,
    });

    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** If → IIfStatement */
  private convertIf(node: ParserNode): IIfStatement {
    const base = this.createNodeBase(ASTNodeTypes.IfStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Label → ILabel */
  private convertLabel(node: ParserNode): ILabel {
    const { name } = node as IParserLabelNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.Label, { name: safeName });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** ParamList → IParameterList */
  private convertParamList(node: ParserNode): IParameterList {
    const base = this.createNodeBase(ASTNodeTypes.ParameterList);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes, true));
  }

  /** Decl → IPointerDeclaration */
  private convertPtrDecl(node: ParserNode): IPointerDeclaration {
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (!typeDecl) {
      throw new Error("Missing TypeDecl in PtrDecl: " + JSON.stringify(node));
    }

    const name = typeDecl.declname ?? "";

    const pointingType = this.findTypeFromTypeDecl(typeDecl);

    const base = this.createNodeBase(ASTNodeTypes.PointerDeclaration, {
      level: 0,
      name,
      pointingType,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Return → IReturnStatement */
  private convertReturn(node: ParserNode): IReturnStatement {
    const base = this.createNodeBase(ASTNodeTypes.ReturnStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /**
   * Convert a single ParserNode via switch, increment counter
   */
  private convertSingleNode(node: ParserNode, fromParam?: boolean): ASTNodes | undefined {
    const kind = node.kind as ParserNodeKind;
    this.counter[kind]++;

    switch (kind) {
      case ParserNodeKind.Alignas:
      case ParserNodeKind.CompoundLiteral:
      case ParserNodeKind.DeclList:
      case ParserNodeKind.EllipsisParam:
      case ParserNodeKind.EmptyStatement:
      case ParserNodeKind.Enum:
      case ParserNodeKind.Enumerator:
      case ParserNodeKind.EnumeratorList:
      case ParserNodeKind.ExprList:
      case ParserNodeKind.IdentifierType:
      case ParserNodeKind.InitList:
      case ParserNodeKind.NamedInitializer:
      case ParserNodeKind.Pragma:
      case ParserNodeKind.StaticAssert:
      case ParserNodeKind.TernaryOp:
      case ParserNodeKind.TypeDecl:
      case ParserNodeKind.Typename:
        return undefined;
      case ParserNodeKind.ArrayDecl:
        return undefined;
      case ParserNodeKind.ArrayRef:
        return this.convertArrayRef(node);
      case ParserNodeKind.Assignment:
        return this.convertAssignment(node);
      case ParserNodeKind.BinaryOp:
        return this.convertBinaryOp(node);
      case ParserNodeKind.Break:
        return this.convertBreak(node);
      case ParserNodeKind.Case:
      case ParserNodeKind.Default:
        return this.convertCase(node);
      case ParserNodeKind.Cast:
        return this.convertCast(node);
      case ParserNodeKind.Compound:
        return this.convertCompound(node);
      case ParserNodeKind.Constant:
        return this.convertConstant(node);
      case ParserNodeKind.Continue:
        return this.convertContinue(node);
      case ParserNodeKind.Decl:
        return fromParam ? this.convertDeclFromParam(node) : this.convertDecl(node);
      case ParserNodeKind.DoWhile:
        return this.convertDoWhile(node);
      case ParserNodeKind.FileAST:
        return this.convertFileAST(node);
      case ParserNodeKind.For:
        return this.convertFor(node);
      case ParserNodeKind.FuncCall:
        return this.convertFuncCall(node);
      case ParserNodeKind.FuncDecl:
        return this.convertFuncDecl(node);
      case ParserNodeKind.FuncDef:
        return this.convertFuncDef(node);
      case ParserNodeKind.Goto:
        return this.convertGoto(node);
      case ParserNodeKind.ID:
        return this.convertID(node);
      case ParserNodeKind.If:
        return this.convertIf(node);
      case ParserNodeKind.Label:
        return this.convertLabel(node);
      case ParserNodeKind.ParamList:
        return this.convertParamList(node);
      case ParserNodeKind.PtrDecl:
        return undefined;
      case ParserNodeKind.Return:
        return this.convertReturn(node);
      case ParserNodeKind.Struct:
        return this.convertStruct(node);
      case ParserNodeKind.StructRef:
        return this.convertStructRef(node);
      case ParserNodeKind.Switch:
        return this.convertSwitch(node);
      case ParserNodeKind.Typedef:
        return this.convertTypedef(node);
      case ParserNodeKind.UnaryOp:
        return this.convertUnaryOp(node);
      case ParserNodeKind.Union:
        return this.convertUnion(node);
      case ParserNodeKind.While:
        return this.convertWhile(node);
      default:
        return this.assertNever(kind);
    }
  }

  /** SizeOf → ISizeOfExpression */
  private convertSizeOf(node: ParserNode): ISizeOfExpression {
    const base = this.createNodeBase(ASTNodeTypes.SizeOfExpression);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Struct → IStructType */
  private convertStruct(node: ParserNode): IStructType {
    const { name } = node as IParserStructNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.StructType, { name: safeName });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** StructRef → IMemberAccess */
  private convertStructRef(node: ParserNode): IMemberAccess {
    const base = this.createNodeBase(ASTNodeTypes.MemberAccess, {
      type: "undefined",
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Switch → ISwitchStatement */
  private convertSwitch(node: ParserNode): ISwitchStatement {
    const base = this.createNodeBase(ASTNodeTypes.SwitchStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Typedef → ITypeDefinition */
  private convertTypedef(node: ParserNode): ITypeDefinition {
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (!typeDecl) {
      throw new Error(`Missing TypeDecl in Typedef: ${JSON.stringify(node)}`);
    }
    const underlyingKind = Array.isArray(typeDecl.children) && typeDecl.children.length > 0 ? typeDecl.children[0].kind : "undefined";
    const { name } = node as IParserTypedefNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.TypeDefinition, {
      name: safeName,
      underlyingType: underlyingKind,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /**
   * UnaryOp → IAddressOfExpression | IPointerDereference | IUnaryExpression | ISizeOfExpression
   */
  private convertUnaryOp(node: ParserNode): IAddressOfExpression | IPointerDereference | ISizeOfExpression | IUnaryExpression {
    const uop = node as IParserUnaryOpNode;

    // sizeof(...) → own SizeOfExpression node
    if (uop.op === "sizeof") {
      return this.convertSizeOf(node);
    }

    // &expr or *expr → special
    if (uop.op === "&" || uop.op === "*") {
      return this.convertUnaryOpToSpecial(uop);
    }

    // everything else is a conventional unary expression
    return this.convertUnaryOpConventional(uop);
  }

  private convertUnaryOpConventional(node: IParserUnaryOpNode): IUnaryExpression {
    let type: string;
    const typeDecl = this.findParserNodeWithType(node, ParserNodeKind.TypeDecl);
    if (typeDecl) {
      const idType = this.findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType);
      type = Array.isArray(idType?.names) ? idType.names.join(" ") : "";
    } else {
      const constNode = this.findParserNodeWithType(node, ParserNodeKind.Constant);
      if (typeof constNode?.type === "string") {
        type = constNode.type;
      } else if (typeof constNode?.type === "number") {
        type = String(constNode.type);
      } else {
        type = "";
      }
    }
    const base = this.createNodeBase(ASTNodeTypes.UnaryExpression, {
      operator: node.op,
      type,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }
  /** UnaryOp → IAddressOfExpression | IPointerDereference */
  private convertUnaryOpToSpecial(node: IParserUnaryOpNode): IAddressOfExpression | IPointerDereference {
    const idNode = this.findParserNodeWithType(node, ParserNodeKind.ID);
    if (!idNode) {
      throw new Error("Missing idNode in UnaryOp for AddressOfExpression: " + JSON.stringify(node));
    }

    const nodeType =
      node.op == "*" ? ASTNodeTypes.PointerDereference : node.op == "&" ? ASTNodeTypes.AddressOfExpression : ASTNodeTypes.AddressOfExpression;

    const base = this.createNodeBase(nodeType, {
      rhs: idNode.name,
    });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** Union → IUnionType */
  private convertUnion(node: ParserNode): IUnionType {
    const { name } = node as IParserUnionNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.UnionType, { name: safeName });
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  /** While → IWhileStatement */
  private convertWhile(node: ParserNode): IWhileStatement {
    const base = this.createNodeBase(ASTNodeTypes.WhileStatement);
    return this.wrapChildren(base, node, (childNodes: ParserNode[]) => this.convertCParserNodes(childNodes));
  }

  private createNodeBase<T extends ASTNodeTypes, U extends object = object>(nodeType: T, extras?: U): U & { id: number; nodeType: T } {
    const base: U & { id: number; nodeType: T } = {
      nodeType,
      ...(extras ?? ({} as U)),
      id: this.nodeIdCounter++,
    };
    return base;
  }

  private findParserNodeWithType<K extends ParserNodeKind>(node: ParserNode, kind: K): KindToNodeMap[K] | undefined {
    if (node.kind === kind) return node as KindToNodeMap[K];
    if (!Array.isArray(node.children)) return undefined;
    for (const child of node.children) {
      const found = this.findParserNodeWithType(child, kind);
      if (found) return found;
    }
    return undefined;
  }

  private findTypeFromTypeDecl(typeDecl?: IParserTypeDeclNode): string {
    const attr = typeDecl?.type ? this.findParserNodeWithType(typeDecl.type, ParserNodeKind.IdentifierType) : undefined;
    const idt = typeDecl ? this.findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType) : undefined;
    return attr?.names.join(" ") ?? idt?.names.join(" ") ?? "undefined";
  }

  private wrapChildren<T extends { nodeType: ASTNodeTypes }>(
    base: T,
    parserNode: ParserNode,
    convertFn: (kids: ParserNode[]) => ASTNodes[]
  ): T & { children?: ASTNodes[] } {
    const rawKids: ParserNode[] = Array.isArray(parserNode.children) ? parserNode.children : [];
    const conv: ASTNodes[] = convertFn(rawKids);

    if (conv.length) {
      // cast to the more specific type so eslint is happy
      (base as T & { children?: ASTNodes[] }).children = conv;
    }
    return base as T & { children?: ASTNodes[] };
  }
}
