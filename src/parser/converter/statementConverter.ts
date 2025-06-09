// src/parser/converter/statementConverters.ts

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
import { IUnaryExpression } from "@/types/Expressions/UnaryExpression";
import {
  IParserGotoNode,
  IParserLabelNode,
  IParserStructNode,
  IParserTypedefNode,
  IParserUnaryOpNode,
  IParserUnionNode,
  ParserNode,
  ParserNodeKind,
} from "@/types/pycparser";

import { createNodeBase, findParserNodeWithType, wrapChildren } from "./helpers";
import { convertCParserNodes } from "./index";

/** Break → IBreakStatement */
export function convertBreak(node: ParserNode): IBreakStatement {
  const base = createNodeBase(ASTNodeTypes.BreakStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Case → ISwitchCase */
export function convertCase(node: ParserNode): ISwitchCase {
  const base = createNodeBase(ASTNodeTypes.SwitchCase);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Compound → ICompoundStatement */
export function convertCompound(node: ParserNode): ICompoundStatement {
  const base = createNodeBase(ASTNodeTypes.CompoundStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Continue → IContinueStatement */
export function convertContinue(node: ParserNode): IContinueStatement {
  const base = createNodeBase(ASTNodeTypes.ContinueStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** DoWhile → IDoWhileStatement */
export function convertDoWhile(node: ParserNode): IDoWhileStatement {
  const base = createNodeBase(ASTNodeTypes.DoWhileStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** For → IForStatement */
export function convertFor(node: ParserNode): IForStatement {
  const base = createNodeBase(ASTNodeTypes.ForStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Goto → IGotoStatement */
export function convertGoto(node: ParserNode): IGotoStatement {
  const { name } = node as IParserGotoNode;
  const jumpTarget = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.GotoStatement, { jumpTarget });
  return wrapChildren(base, node, convertCParserNodes);
}

/** If → IIfStatement */
export function convertIf(node: ParserNode): IIfStatement {
  const base = createNodeBase(ASTNodeTypes.IfStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Label → ILabel */
export function convertLabel(node: ParserNode): ILabel {
  const { name } = node as IParserLabelNode;
  const safeName = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.Label, { name: safeName });
  return wrapChildren(base, node, convertCParserNodes);
}

/** Return → IReturnStatement */
export function convertReturn(node: ParserNode): IReturnStatement {
  const base = createNodeBase(ASTNodeTypes.ReturnStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Struct → IStructType */
export function convertStruct(node: ParserNode): IStructType {
  const { name } = node as IParserStructNode;
  const safeName = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.StructType, { name: safeName });
  return wrapChildren(base, node, convertCParserNodes);
}

/** Switch → ISwitchStatement */
export function convertSwitch(node: ParserNode): ISwitchStatement {
  const base = createNodeBase(ASTNodeTypes.SwitchStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Typedef → ITypeDefinition */
export function convertTypedef(node: ParserNode): ITypeDefinition {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error(`Missing TypeDecl in Typedef: ${JSON.stringify(node)}`);
  }
  const underlyingKind = Array.isArray(typeDecl.children) && typeDecl.children.length > 0 ? typeDecl.children[0].kind : "undefined";
  const { name } = node as IParserTypedefNode;
  const safeName = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.TypeDefinition, {
    name: safeName,
    underlyingType: underlyingKind,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** UnaryOp → IUnaryExpression */
export function convertUnaryOp(node: ParserNode): IUnaryExpression {
  const uop = node as IParserUnaryOpNode;
  let type: string;
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (typeDecl) {
    const idType = findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType);
    type = Array.isArray(idType?.names) ? idType.names.join(" ") : "";
  } else {
    const constNode = findParserNodeWithType(node, ParserNodeKind.Constant);
    if (typeof constNode?.type === "string") {
      type = constNode.type;
    } else if (typeof constNode?.type === "number") {
      type = String(constNode.type);
    } else {
      type = "";
    }
  }
  const base = createNodeBase(ASTNodeTypes.UnaryExpression, {
    operator: uop.op,
    type,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** Union → IUnionType */
export function convertUnion(node: ParserNode): IUnionType {
  const { name } = node as IParserUnionNode;
  const safeName = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.UnionType, { name: safeName });
  return wrapChildren(base, node, convertCParserNodes);
}

/** While → IWhileStatement */
export function convertWhile(node: ParserNode): IWhileStatement {
  const base = createNodeBase(ASTNodeTypes.WhileStatement);
  return wrapChildren(base, node, convertCParserNodes);
}
