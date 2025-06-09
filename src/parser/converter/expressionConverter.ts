// src/parser/converter/expressionConverters.ts

import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { IArraySubscriptionExpression } from "@/types/Expressions/ArraySubscriptExpression";
import { IAssignmentExpression } from "@/types/Expressions/AssignmentExpression";
import { IBinaryExpression } from "@/types/Expressions/BinaryExpression";
import { ICastExpression } from "@/types/Expressions/CastExpression";
import { IIdentifier } from "@/types/Expressions/Identifier";
import { IMemberAccess } from "@/types/Expressions/MemberAccess";
import { IArrayDeclaration } from "@/types/ProgramStructures/ArrayDeclaration";
import { IFunctionDeclaration } from "@/types/ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "@/types/ProgramStructures/FunctionDefinition";
import { IPointerDeclaration } from "@/types/ProgramStructures/PointerDeclaration";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import { IParserAssignmentNode, IParserBinaryOpNode, IParserIDNode, ParserNode, ParserNodeKind } from "@/types/pycparser";

import { createNodeBase, findParserNodeWithType, wrapChildren } from "./helpers";
import { convertCParserNodes } from "./index";

/** ArrayDecl → IArrayDeclaration */
export function convertArrayDecl(node: ParserNode): IArrayDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  const constNode = findParserNodeWithType(node, ParserNodeKind.Constant);
  if (!typeDecl || !constNode) {
    throw new Error("Missing TypeDecl or Constant in ArrayDecl: " + JSON.stringify(node));
  }

  const idType = (typeDecl.children ?? []).find((c) => c.kind === ParserNodeKind.IdentifierType);

  const name = typeof typeDecl.declname === "string" ? typeDecl.declname : "";

  let elementType = "";
  if (idType && Array.isArray(idType.names)) {
    elementType = idType.names.join(" ");
  }

  // rawLength.value is always present on Constant
  const rawLength = constNode.value;
  const length = typeof rawLength === "string" && /^\d+$/.test(rawLength) ? parseInt(rawLength, 10) : 0;

  const base = createNodeBase(ASTNodeTypes.ArrayDeclaration, {
    elementType,
    length,
    name,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** ArrayRef → IArraySubscriptionExpression */
export function convertArrayRef(node: ParserNode): IArraySubscriptionExpression {
  const base = createNodeBase(ASTNodeTypes.ArraySubscriptionExpression);
  return wrapChildren(base, node, convertCParserNodes);
}

/** Assignment → IAssignmentExpression */
export function convertAssignment(node: ParserNode): IAssignmentExpression {
  const { op } = node as IParserAssignmentNode;
  const base = createNodeBase(ASTNodeTypes.AssignmentExpression, {
    operator: op,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** BinaryOp → IBinaryExpression */
export function convertBinaryOp(node: ParserNode): IBinaryExpression {
  const bin = node as IParserBinaryOpNode;
  const kids = Array.isArray(bin.children) ? bin.children : [];
  if (kids.length !== 2) {
    throw new Error("BinaryOp expects 2 children, got " + kids.length.toString());
  }

  const left = kids[0] as ParserNode & { type?: string };
  const right = kids[1] as ParserNode & { type?: string };
  const typeLeft = typeof left.type === "string" ? left.type : left.kind;
  const typeRight = typeof right.type === "string" ? right.type : right.kind;

  const base = createNodeBase(ASTNodeTypes.BinaryExpression, {
    operator: bin.op,
    type: `${typeLeft}/${typeRight}`,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** Cast → ICastExpression */
export function convertCast(node: ParserNode): ICastExpression {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in Cast: " + JSON.stringify(node));
  }

  const idType = findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType);
  if (!idType || !Array.isArray(idType.names)) {
    throw new Error("Invalid IdentifierType under TypeDecl in Cast: " + JSON.stringify(node));
  }

  const targetType = idType.names.join(" ");
  const base = createNodeBase(ASTNodeTypes.CastExpression, { targetType });
  return wrapChildren(base, node, convertCParserNodes);
}

/** FileAST → ITranslationUnit */
export function convertFileAST(node: ParserNode): ITranslationUnit {
  const base = createNodeBase(ASTNodeTypes.TranslationUnit);
  return wrapChildren(base, node, convertCParserNodes);
}

/** FuncDecl → IFunctionDeclaration */
export function convertFuncDecl(node: ParserNode): IFunctionDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in FuncDecl: " + JSON.stringify(node));
  }

  const idType = findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType);
  if (!idType || !Array.isArray(idType.names)) {
    throw new Error("Invalid IdentifierType under TypeDecl in FuncDecl: " + JSON.stringify(node));
  }

  const name = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
  const returnType = idType.names.join(" ");
  const base = createNodeBase(ASTNodeTypes.FunctionDeclaration, {
    name,
    returnType,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** FuncDef → IFunctionDefinition */
export function convertFuncDef(node: ParserNode): IFunctionDefinition {
  const funcDecl = findParserNodeWithType(node, ParserNodeKind.FuncDecl);
  if (!funcDecl) {
    throw new Error("Missing FuncDecl in FuncDef: " + JSON.stringify(node));
  }
  const typeDecl = findParserNodeWithType(funcDecl, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl under FuncDecl in FuncDef: " + JSON.stringify(node));
  }
  const idType = findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType);
  if (!idType || !Array.isArray(idType.names)) {
    throw new Error("Invalid IdentifierType under TypeDecl in FuncDef: " + JSON.stringify(node));
  }

  const functionName = typeof typeDecl.declname === "string" ? typeDecl.declname : "";
  const returnType = idType.names.join(" ");
  const base = createNodeBase(ASTNodeTypes.FunctionDefinition, {
    name: functionName,
    returnType,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** ID → IIdentifier */
export function convertID(node: ParserNode): IIdentifier {
  const { name } = node as IParserIDNode;
  const safeName = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.Identifier, {
    name: safeName,
    size: "undefined",
    type: "undefined",
  });

  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (typeDecl) {
    const idType = findParserNodeWithType(typeDecl, ParserNodeKind.IdentifierType);
    if (idType && Array.isArray(idType.names)) {
      base.type = idType.names.join(" ");
    }
  }

  return wrapChildren(base, node, convertCParserNodes);
}

/** PtrDecl → IPointerDeclaration */
export function convertPtrDecl(node: ParserNode): IPointerDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in PtrDecl: " + JSON.stringify(node));
  }

  const idType = (typeDecl.children ?? []).find((c) => c.kind === ParserNodeKind.IdentifierType);

  const name = typeof typeDecl.declname === "string" ? typeDecl.declname : "";

  let pointsTo = "";
  if (idType && Array.isArray(idType.names)) {
    pointsTo = idType.names.join(" ");
  }

  const base = createNodeBase(ASTNodeTypes.PointerDeclaration, {
    level: 0,
    name,
    pointsTo,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** StructRef → IMemberAccess */
export function convertStructRef(node: ParserNode): IMemberAccess {
  const base = createNodeBase(ASTNodeTypes.MemberAccess, {
    type: "undefined",
  });
  return wrapChildren(base, node, convertCParserNodes);
}
