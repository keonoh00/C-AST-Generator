// src/parser/converter/index.ts
/* eslint-disable @typescript-eslint/no-extraneous-class */
import { ASTNodes } from "@/types/node";
import { ParserASTNode, ParserKind } from "@/types/PyCParser/pycparser";

import {
  convertArrayDecl,
  convertArrayRef,
  convertAssignment,
  convertBinaryOp,
  convertCast,
  convertFileAST,
  convertFuncDecl,
  convertFuncDef,
  convertID,
  convertPtrDecl,
  convertStructRef,
} from "./expressionConverter";
import {
  convertBreak,
  convertCase,
  convertCompound,
  convertContinue,
  convertDoWhile,
  convertFor,
  convertGoto,
  convertIf,
  convertLabel,
  convertReturn,
  convertStruct,
  convertSwitch,
  convertTypedef,
  convertUnaryOp,
  convertUnion,
  convertWhile,
} from "./statementConverter";

type ConverterFn = (node: ParserASTNode) => ASTNodes | undefined;

export class CParserNodeConverter {
  private static readonly converters: Record<ParserKind, ConverterFn> = {
    [ParserKind.Alignas]: () => undefined,
    [ParserKind.ArrayDecl]: (n) => convertArrayDecl(n),
    [ParserKind.ArrayRef]: (n) => convertArrayRef(n),
    [ParserKind.Assignment]: (n) => convertAssignment(n),
    [ParserKind.BinaryOp]: (n) => convertBinaryOp(n),
    [ParserKind.Break]: (n) => convertBreak(n),
    [ParserKind.Case]: (n) => convertCase(n),
    [ParserKind.Cast]: (n) => convertCast(n),
    [ParserKind.Compound]: (n) => convertCompound(n),
    [ParserKind.CompoundLiteral]: () => undefined,
    [ParserKind.Constant]: () => undefined,
    [ParserKind.Continue]: (n) => convertContinue(n),
    [ParserKind.Decl]: () => undefined,
    [ParserKind.DeclList]: () => undefined,
    [ParserKind.Default]: (n) => convertCase(n),
    [ParserKind.DoWhile]: (n) => convertDoWhile(n),
    [ParserKind.EllipsisParam]: () => undefined,
    [ParserKind.EmptyStatement]: () => undefined,
    [ParserKind.Enum]: () => undefined,
    [ParserKind.Enumerator]: () => undefined,
    [ParserKind.EnumeratorList]: () => undefined,
    [ParserKind.ExprList]: () => undefined,
    [ParserKind.FileAST]: (n) => convertFileAST(n),
    [ParserKind.For]: (n) => convertFor(n),
    [ParserKind.FuncCall]: () => undefined,
    [ParserKind.FuncDecl]: (n) => convertFuncDecl(n),
    [ParserKind.FuncDef]: (n) => convertFuncDef(n),
    [ParserKind.Goto]: (n) => convertGoto(n),
    [ParserKind.ID]: (n) => convertID(n),
    [ParserKind.IdentifierType]: () => undefined,
    [ParserKind.If]: (n) => convertIf(n),
    [ParserKind.InitList]: () => undefined,
    [ParserKind.Label]: (n) => convertLabel(n),
    [ParserKind.NamedInitializer]: () => undefined,
    [ParserKind.ParamList]: () => undefined,
    [ParserKind.Pragma]: () => undefined,
    [ParserKind.PtrDecl]: (n) => convertPtrDecl(n),
    [ParserKind.Return]: (n) => convertReturn(n),
    [ParserKind.StaticAssert]: () => undefined,
    [ParserKind.Struct]: (n) => convertStruct(n),
    [ParserKind.StructRef]: (n) => convertStructRef(n),
    [ParserKind.Switch]: (n) => convertSwitch(n),
    [ParserKind.TernaryOp]: () => undefined,
    [ParserKind.TypeDecl]: () => undefined,
    [ParserKind.Typedef]: (n) => convertTypedef(n),
    [ParserKind.Typename]: () => undefined,
    [ParserKind.UnaryOp]: (n) => convertUnaryOp(n),
    [ParserKind.Union]: (n) => convertUnion(n),
    [ParserKind.While]: (n) => convertWhile(n),
  };

  /** Dispatch a single ParserASTNode → ASTNodes | undefined */
  public static convertSingleNode(parserNode: ParserASTNode): ASTNodes | undefined {
    const kind = parserNode.kind as ParserKind;
    return CParserNodeConverter.converters[kind](parserNode);
  }
}

/**
 * Given an array of ParserASTNode, convert each via the correct converter,
 * and filter out `undefined`.
 */
export function convertCParserNodes(parserNodes: ParserASTNode[]): ASTNodes[] {
  return parserNodes.map((n) => CParserNodeConverter.convertSingleNode(n)).filter((n): n is ASTNodes => !!n);
}
