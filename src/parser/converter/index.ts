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
  IParserAssignmentNode,
  IParserBinaryOpNode,
  IParserGotoNode,
  IParserIDNode,
  IParserLabelNode,
  IParserStructNode,
  IParserTypedefNode,
  IParserUnaryOpNode,
  IParserUnionNode,
  KindToNodeMap,
  ParserASTNode,
  ParserKind,
} from "@/types/PyCParser/pycparser";

type Converter = (node: ParserASTNode) => ASTNodes | undefined;

export class CParserNodeConverter {
  /** Map each ParserKind to its converter function. */
  private readonly converters: Record<ParserKind, Converter> = {
    [ParserKind.Alignas]: () => undefined,
    [ParserKind.ArrayDecl]: (n) => this.convertArrayDecl(n),
    [ParserKind.ArrayRef]: (n) => this.convertArrayRef(n),
    [ParserKind.Assignment]: (n) => this.convertAssignment(n),
    [ParserKind.BinaryOp]: (n) => this.convertBinaryOp(n),
    [ParserKind.Break]: (n) => this.convertBreak(n),
    [ParserKind.Case]: (n) => this.convertCase(n),
    [ParserKind.Cast]: (n) => this.convertCast(n),
    [ParserKind.Compound]: (n) => this.convertCompound(n),
    [ParserKind.CompoundLiteral]: () => undefined,
    [ParserKind.Constant]: () => undefined,
    [ParserKind.Continue]: (n) => this.convertContinue(n),
    [ParserKind.Decl]: () => undefined,
    [ParserKind.DeclList]: () => undefined,
    [ParserKind.Default]: (n) => this.convertCase(n),
    [ParserKind.DoWhile]: (n) => this.convertDoWhile(n),
    [ParserKind.EllipsisParam]: () => undefined,
    [ParserKind.EmptyStatement]: () => undefined,
    [ParserKind.Enum]: () => undefined,
    [ParserKind.Enumerator]: () => undefined,
    [ParserKind.EnumeratorList]: () => undefined,
    [ParserKind.ExprList]: () => undefined,
    [ParserKind.FileAST]: (n) => this.convertFileAST(n),
    [ParserKind.For]: (n) => this.convertFor(n),
    [ParserKind.FuncCall]: () => undefined,
    [ParserKind.FuncDecl]: (n) => this.convertFuncDecl(n),
    [ParserKind.FuncDef]: (n) => this.convertFuncDef(n),
    [ParserKind.Goto]: (n) => this.convertGoto(n),
    [ParserKind.ID]: (n) => this.convertID(n),
    [ParserKind.IdentifierType]: () => undefined,
    [ParserKind.If]: (n) => this.convertIf(n),
    [ParserKind.InitList]: () => undefined,
    [ParserKind.Label]: (n) => this.convertLabel(n),
    [ParserKind.NamedInitializer]: () => undefined,
    [ParserKind.ParamList]: () => undefined,
    [ParserKind.Pragma]: () => undefined,
    [ParserKind.PtrDecl]: (n) => this.convertPtrDecl(n),
    [ParserKind.Return]: (n) => this.convertReturn(n),
    [ParserKind.StaticAssert]: () => undefined,
    [ParserKind.Struct]: (n) => this.convertStruct(n),
    [ParserKind.StructRef]: (n) => this.convertStructRef(n),
    [ParserKind.Switch]: (n) => this.convertSwitch(n),
    [ParserKind.TernaryOp]: () => undefined,
    [ParserKind.TypeDecl]: () => undefined,
    [ParserKind.Typedef]: (n) => this.convertTypedef(n),
    [ParserKind.Typename]: () => undefined,
    [ParserKind.UnaryOp]: (n) => this.convertUnaryOp(n),
    [ParserKind.Union]: (n) => this.convertUnion(n),
    [ParserKind.While]: (n) => this.convertWhile(n),
  };

  /** Main entry: convert an array of parser nodes → ASTNodes (filter out undefined). */
  public convertCParserNodes(parserNodes: ParserASTNode[]): ASTNodes[] {
    return parserNodes.map((n) => this.convertSingleNode(n)).filter((n): n is ASTNodes => !!n);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // ────────────────────────────── Conversion Helpers ─────────────────────────────

  /** ArrayDecl → IArrayDeclaration */
  private convertArrayDecl(node: ParserASTNode): IArrayDeclaration {
    // Find the `TypeDecl` child and the `Constant` child
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
    const constNode = this.findParserNodeWithType(node, ParserKind.Constant);
    if (!typeDecl || !constNode) {
      throw new Error(`Missing TypeDecl or Constant in ArrayDecl: ${JSON.stringify(node)}`);
    }

    // Under TypeDecl, look for IdentifierType → { names: string[] }
    const idType = (typeDecl.children ?? []).find((c) => c.kind === ParserKind.IdentifierType) as
      | (KindToNodeMap[ParserKind.IdentifierType] & { names?: string[] })
      | undefined;

    const name = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
    const elementType = idType?.names?.join(" ") ?? "";

    // Instead of `as any`, cast to the known shape of a Constant node
    const constNodeTyped = constNode as KindToNodeMap[ParserKind.Constant] & { value?: string };
    const rawLength = constNodeTyped.value ?? "";
    const length = typeof rawLength === "string" && /^\d+$/.test(rawLength) ? parseInt(rawLength, 10) : 0;

    const base = this.createNodeBase(ASTNodeTypes.ArrayDeclaration, { elementType, length, name });
    return this.wrapChildren(base, node);
  }

  /** ArrayRef → IArraySubscriptionExpression */
  private convertArrayRef(node: ParserASTNode): IArraySubscriptionExpression {
    const base = this.createNodeBase(ASTNodeTypes.ArraySubscriptionExpression);
    return this.wrapChildren(base, node);
  }

  /** Assignment → IAssignmentExpression */
  private convertAssignment(node: ParserASTNode): IAssignmentExpression {
    const { op } = node as IParserAssignmentNode;
    const base = this.createNodeBase(ASTNodeTypes.AssignmentExpression, { operator: op as string });
    return this.wrapChildren(base, node);
  }

  /** BinaryOp → IBinaryExpression */
  private convertBinaryOp(node: ParserASTNode): IBinaryExpression {
    const bin = node as IParserBinaryOpNode;
    const kids = Array.isArray(bin.children) ? bin.children : [];
    if (kids.length !== 2) {
      // Wrap kids.length in String(...) to satisfy `restrict-template-expressions`
      throw new Error(`BinaryOp expects 2 children, got ${String(kids.length)}`);
    }

    const left = kids[0] as ParserASTNode & { type?: string };
    const right = kids[1] as ParserASTNode & { type?: string };
    const typeLeft = typeof left.type === "string" ? left.type : left.kind;
    const typeRight = typeof right.type === "string" ? right.type : right.kind;

    const base = this.createNodeBase(ASTNodeTypes.BinaryExpression, {
      operator: bin.op as string,
      type: `${typeLeft}/${typeRight}`,
    });
    return this.wrapChildren(base, node);
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // ───────────────────────────── Node Converters ────────────────────────────────

  /** Break → IBreakStatement */
  private convertBreak(node: ParserASTNode): IBreakStatement {
    const base = this.createNodeBase(ASTNodeTypes.BreakStatement);
    return this.wrapChildren(base, node);
  }

  /** Case (and Default) → ISwitchCase */
  private convertCase(node: ParserASTNode): ISwitchCase {
    const base = this.createNodeBase(ASTNodeTypes.SwitchCase);
    return this.wrapChildren(base, node);
  }

  /** Cast → ICastExpression */
  private convertCast(node: ParserASTNode): ICastExpression {
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
    if (!typeDecl) {
      throw new Error(`Missing TypeDecl in Cast: ${JSON.stringify(node)}`);
    }
    const idType = this.findParserNodeWithType(typeDecl, ParserKind.IdentifierType);
    if (!idType?.names || !Array.isArray(idType.names)) {
      throw new Error(`Invalid IdentifierType under TypeDecl in Cast: ${JSON.stringify(node)}`);
    }
    const targetType = idType.names.join(" ");
    const base = this.createNodeBase(ASTNodeTypes.CastExpression, { targetType });
    return this.wrapChildren(base, node);
  }

  /** Compound → ICompoundStatement */
  private convertCompound(node: ParserASTNode): ICompoundStatement {
    const base = this.createNodeBase(ASTNodeTypes.CompoundStatement);
    return this.wrapChildren(base, node);
  }

  /** Continue → IContinueStatement */
  private convertContinue(node: ParserASTNode): IContinueStatement {
    const base = this.createNodeBase(ASTNodeTypes.ContinueStatement);
    return this.wrapChildren(base, node);
  }

  /** DoWhile → IDoWhileStatement */
  private convertDoWhile(node: ParserASTNode): IDoWhileStatement {
    const base = this.createNodeBase(ASTNodeTypes.DoWhileStatement);
    return this.wrapChildren(base, node);
  }

  /** FileAST → ITranslationUnit */
  private convertFileAST(node: ParserASTNode): ITranslationUnit {
    const base = this.createNodeBase(ASTNodeTypes.TranslationUnit);
    return this.wrapChildren(base, node);
  }

  /** For → IForStatement */
  private convertFor(node: ParserASTNode): IForStatement {
    const base = this.createNodeBase(ASTNodeTypes.ForStatement);
    return this.wrapChildren(base, node);
  }

  /** FuncDecl → IFunctionDeclaration */
  private convertFuncDecl(node: ParserASTNode): IFunctionDeclaration {
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
    if (!typeDecl) {
      throw new Error(`Missing TypeDecl in FuncDecl: ${JSON.stringify(node)}`);
    }
    const idType = this.findParserNodeWithType(typeDecl, ParserKind.IdentifierType);
    // FIRST check idType, then check its .names array
    if (!idType || !Array.isArray(idType.names)) {
      throw new Error(`Invalid IdentifierType under TypeDecl in FuncDecl: ${JSON.stringify(node)}`);
    }
    const name = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
    const returnType = idType.names.join(" ");
    const base = this.createNodeBase(ASTNodeTypes.FunctionDeclaration, { name, returnType });
    return this.wrapChildren(base, node);
  }

  /** FuncDef → IFunctionDefinition */
  private convertFuncDef(node: ParserASTNode): IFunctionDefinition {
    const funcDecl = this.findParserNodeWithType(node, ParserKind.FuncDecl);
    if (!funcDecl) {
      throw new Error(`Missing FuncDecl in FuncDef: ${JSON.stringify(node)}`);
    }
    const typeDecl = this.findParserNodeWithType(funcDecl, ParserKind.TypeDecl);
    if (!typeDecl) {
      throw new Error(`Missing TypeDecl under FuncDecl in FuncDef: ${JSON.stringify(node)}`);
    }
    const idType = this.findParserNodeWithType(typeDecl, ParserKind.IdentifierType);
    // FIRST check idType, then check its .names array
    if (!idType || !Array.isArray(idType.names)) {
      throw new Error(`Invalid IdentifierType under TypeDecl in FuncDef: ${JSON.stringify(node)}`);
    }
    const functionName = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
    const returnType = idType.names.join(" ");
    const base = this.createNodeBase(ASTNodeTypes.FunctionDefinition, {
      name: functionName,
      returnType,
    });
    return this.wrapChildren(base, node);
  }

  /** Goto → IGotoStatement */
  private convertGoto(node: ParserASTNode): IGotoStatement {
    const { name } = node as IParserGotoNode;
    const jumpTarget = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.GotoStatement, { jumpTarget });
    return this.wrapChildren(base, node);
  }

  /** ID → IIdentifier */
  private convertID(node: ParserASTNode): IIdentifier {
    const { name } = node as IParserIDNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.Identifier, {
      name: safeName,
      size: "undefined",
      type: "undefined",
    });
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
    if (typeDecl) {
      const idType = this.findParserNodeWithType(typeDecl, ParserKind.IdentifierType);
      if (idType && Array.isArray(idType.names)) {
        base.type = idType.names.join(" ");
      }
    }
    return this.wrapChildren(base, node);
  }

  /** If → IIfStatement */
  private convertIf(node: ParserASTNode): IIfStatement {
    const base = this.createNodeBase(ASTNodeTypes.IfStatement);
    return this.wrapChildren(base, node);
  }

  /** Label → ILabel */
  private convertLabel(node: ParserASTNode): ILabel {
    const { name } = node as IParserLabelNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.Label, { name: safeName });
    return this.wrapChildren(base, node);
  }

  /** PtrDecl → IPointerDeclaration */
  private convertPtrDecl(node: ParserASTNode): IPointerDeclaration {
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
    if (!typeDecl) {
      throw new Error(`Missing TypeDecl in PtrDecl: ${JSON.stringify(node)}`);
    }
    const idType = (typeDecl.children ?? []).find((c) => c.kind === ParserKind.IdentifierType) as
      | (KindToNodeMap[ParserKind.IdentifierType] & { names?: string[] })
      | undefined;

    const name = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
    const pointsTo = idType?.names?.join(" ") ?? "";
    const base = this.createNodeBase(ASTNodeTypes.PointerDeclaration, {
      level: 0,
      name,
      pointsTo,
    });
    return this.wrapChildren(base, node);
  }

  /** Return → IReturnStatement */
  private convertReturn(node: ParserASTNode): IReturnStatement {
    const base = this.createNodeBase(ASTNodeTypes.ReturnStatement);
    return this.wrapChildren(base, node);
  }

  /** Dispatch a single node via the `converters` table; error if truly unknown. */
  private convertSingleNode(parserNode: ParserASTNode): ASTNodes | undefined {
    const kind = parserNode.kind as ParserKind;
    const fn = this.converters[kind];

    return fn(parserNode);
  }

  /** Struct → IStructType */
  private convertStruct(node: ParserASTNode): IStructType {
    const { name } = node as IParserStructNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.StructType, { name: safeName });
    return this.wrapChildren(base, node);
  }

  /** StructRef → IMemberAccess */
  private convertStructRef(node: ParserASTNode): IMemberAccess {
    const base = this.createNodeBase(ASTNodeTypes.MemberAccess, { type: "undefined" });
    return this.wrapChildren(base, node);
  }

  /** Switch → ISwitchStatement */
  private convertSwitch(node: ParserASTNode): ISwitchStatement {
    const base = this.createNodeBase(ASTNodeTypes.SwitchStatement);
    return this.wrapChildren(base, node);
  }

  /** Typedef → ITypeDefinition */
  private convertTypedef(node: ParserASTNode): ITypeDefinition {
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
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
    return this.wrapChildren(base, node);
  }

  /** UnaryOp → IUnarayExpression */
  private convertUnaryOp(node: ParserASTNode): IUnarayExpression {
    const uop = node as IParserUnaryOpNode;
    let type: string;
    const typeDecl = this.findParserNodeWithType(node, ParserKind.TypeDecl);
    if (typeDecl) {
      const idType = this.findParserNodeWithType(typeDecl, ParserKind.IdentifierType);
      type = Array.isArray(idType?.names) ? idType.names.join(" ") : "";
    } else {
      const constNode = this.findParserNodeWithType(node, ParserKind.Constant) as (ParserASTNode & { type?: unknown }) | undefined;
      // Only call String(...) on primitives
      const rawType = constNode?.type;
      if (typeof rawType === "string") {
        type = rawType;
      } else if (typeof rawType === "number") {
        type = String(rawType);
      } else {
        type = "";
      }
    }
    const base = this.createNodeBase(ASTNodeTypes.UnarayExpression, {
      operator: uop.op as string,
      type,
    });
    return this.wrapChildren(base, node);
  }

  /** Union → IUnionType */
  private convertUnion(node: ParserASTNode): IUnionType {
    const { name } = node as IParserUnionNode;
    const safeName = typeof name === "string" ? name : "";
    const base = this.createNodeBase(ASTNodeTypes.UnionType, { name: safeName });
    return this.wrapChildren(base, node);
  }

  /** While → IWhileStatement */
  private convertWhile(node: ParserASTNode): IWhileStatement {
    const base = this.createNodeBase(ASTNodeTypes.WhileStatement);
    return this.wrapChildren(base, node);
  }

  /**
   * Create a “base” object with exactly `{ nodeType: T } & extras`.
   * Because `T extends ASTNodeTypes` is a literal, TS will infer that
   * `nodeType` is *exactly* that member (e.g. `ASTNodeTypes.ArrayDeclaration`),
   * rather than the whole union. That satisfies things like `IArrayDeclaration.nodeType`.
   *
   * Changed the default for `U` from `{}` to `Record<string, unknown>` so
   * we don’t trigger `no-empty-object-type`.
   */
  private createNodeBase<T extends ASTNodeTypes, U extends object = Record<string, unknown>>(nodeType: T, extras?: U): U & { nodeType: T } {
    return { nodeType, ...(extras ?? ({} as U)) };
  }

  /**
   * Recursively find the first descendant whose `.kind === kind`.
   * Returns undefined if none is found.
   */
  private findParserNodeWithType<K extends ParserKind>(node: ParserASTNode, kind: K): KindToNodeMap[K] | undefined {
    if (node.kind === kind) {
      return node as KindToNodeMap[K];
    }
    if (!Array.isArray(node.children)) {
      return undefined;
    }
    for (const c of node.children) {
      const found = this.findParserNodeWithType(c, kind);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Take any “base” that has at least `{ nodeType: ASTNodeTypes }`,
   * convert all of its children, and if nonempty, attach under `.children`.
   */
  private wrapChildren<T extends { nodeType: ASTNodeTypes }>(base: T, parserNode: ParserASTNode): T & { children?: ASTNodes[] } {
    const rawKids = Array.isArray(parserNode.children) ? parserNode.children : [];
    const convertedKids = this.convertCParserNodes(rawKids);

    if (convertedKids.length > 0) {
      (base as T & { children?: ASTNodes[] }).children = convertedKids;
    }
    return base as T & { children?: ASTNodes[] };
  }
}
