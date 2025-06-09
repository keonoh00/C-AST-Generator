// src/parser/converter/index.ts
/* eslint-disable @typescript-eslint/no-extraneous-class */
import { ASTNodes } from "@/types/node";
import { ParserNode, ParserNodeKind } from "@/types/pycparser";

import {
  convertArrayDecl,
  convertArrayRef,
  convertAssignment,
  convertBinaryOp,
  convertCast,
  convertDecl,
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

type ConverterFn = (node: ParserNode) => ASTNodes | undefined;

export class CParserNodeConverter {
  private static readonly converters: Record<ParserNodeKind, ConverterFn> = {
    [ParserNodeKind.Alignas]: () => undefined,
    [ParserNodeKind.ArrayDecl]: (n) => convertArrayDecl(n),
    [ParserNodeKind.ArrayRef]: (n) => convertArrayRef(n),
    [ParserNodeKind.Assignment]: (n) => convertAssignment(n),
    [ParserNodeKind.BinaryOp]: (n) => convertBinaryOp(n),
    [ParserNodeKind.Break]: (n) => convertBreak(n),
    [ParserNodeKind.Case]: (n) => convertCase(n),
    [ParserNodeKind.Cast]: (n) => convertCast(n),
    [ParserNodeKind.Compound]: (n) => convertCompound(n),
    [ParserNodeKind.CompoundLiteral]: () => undefined,
    [ParserNodeKind.Constant]: () => undefined,
    [ParserNodeKind.Continue]: (n) => convertContinue(n),
    [ParserNodeKind.Decl]: (n) => convertDecl(n),
    [ParserNodeKind.DeclList]: () => undefined,
    [ParserNodeKind.Default]: (n) => convertCase(n),
    [ParserNodeKind.DoWhile]: (n) => convertDoWhile(n),
    [ParserNodeKind.EllipsisParam]: () => undefined,
    [ParserNodeKind.EmptyStatement]: () => undefined,
    [ParserNodeKind.Enum]: () => undefined,
    [ParserNodeKind.Enumerator]: () => undefined,
    [ParserNodeKind.EnumeratorList]: () => undefined,
    [ParserNodeKind.ExprList]: () => undefined,
    [ParserNodeKind.FileAST]: (n) => convertFileAST(n),
    [ParserNodeKind.For]: (n) => convertFor(n),
    [ParserNodeKind.FuncCall]: () => undefined,
    [ParserNodeKind.FuncDecl]: (n) => convertFuncDecl(n),
    [ParserNodeKind.FuncDef]: (n) => convertFuncDef(n),
    [ParserNodeKind.Goto]: (n) => convertGoto(n),
    [ParserNodeKind.ID]: (n) => convertID(n),
    [ParserNodeKind.IdentifierType]: () => undefined,
    [ParserNodeKind.If]: (n) => convertIf(n),
    [ParserNodeKind.InitList]: () => undefined,
    [ParserNodeKind.Label]: (n) => convertLabel(n),
    [ParserNodeKind.NamedInitializer]: () => undefined,
    [ParserNodeKind.ParamList]: () => undefined,
    [ParserNodeKind.Pragma]: () => undefined,
    [ParserNodeKind.PtrDecl]: (n) => convertPtrDecl(n),
    [ParserNodeKind.Return]: (n) => convertReturn(n),
    [ParserNodeKind.StaticAssert]: () => undefined,
    [ParserNodeKind.Struct]: (n) => convertStruct(n),
    [ParserNodeKind.StructRef]: (n) => convertStructRef(n),
    [ParserNodeKind.Switch]: (n) => convertSwitch(n),
    [ParserNodeKind.TernaryOp]: () => undefined,
    [ParserNodeKind.TypeDecl]: () => undefined,
    [ParserNodeKind.Typedef]: (n) => convertTypedef(n),
    [ParserNodeKind.Typename]: () => undefined,
    [ParserNodeKind.UnaryOp]: (n) => convertUnaryOp(n),
    [ParserNodeKind.Union]: (n) => convertUnion(n),
    [ParserNodeKind.While]: (n) => convertWhile(n),
  };

  /** Dispatch a single ParserNode → ASTNodes | undefined */
  public static convertSingleNode(parserNode: ParserNode): ASTNodes | undefined {
    const kind = parserNode.kind as ParserNodeKind;
    return CParserNodeConverter.converters[kind](parserNode);
  }
}

/**
 * Given an array of ParserNode, convert each via the correct converter,
 * and filter out `undefined`.
 */
export function convertCParserNodes(parserNodes: ParserNode[]): ASTNodes[] {
  return parserNodes.map((n) => CParserNodeConverter.convertSingleNode(n)).filter((n): n is ASTNodes => !!n);
}
