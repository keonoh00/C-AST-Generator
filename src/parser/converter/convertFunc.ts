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
import { IUnaryExpression } from "@/types/Expressions/UnaryExpression";
import { IArrayDeclaration } from "@/types/ProgramStructures/ArrayDeclaration";
import { IFunctionDeclaration } from "@/types/ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "@/types/ProgramStructures/FunctionDefinition";
import { IPointerDeclaration } from "@/types/ProgramStructures/PointerDeclaration";
import { ITranslationUnit } from "@/types/ProgramStructures/TranslationUnit";
import { IVariableDeclaration } from "@/types/ProgramStructures/VariableDeclaration";
import {
  IParserAssignmentNode,
  IParserBinaryOpNode,
  IParserDeclNode,
  IParserGotoNode,
  IParserIDNode,
  IParserLabelNode,
  IParserStructNode,
  IParserTypedefNode,
  IParserUnaryOpNode,
  IParserUnionNode,
  ParserNode,
  ParserNodeKind,
} from "@/types/pycparser";

import { createNodeBase, findParserNodeWithType, findTypeFromTypeDecl, wrapChildren } from "./helpers";
import { convertCParserNodes } from "./index";

/** ArrayDecl → IArrayDeclaration */
export function convertArrayDecl(node: ParserNode): IArrayDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  const constNode = findParserNodeWithType(node, ParserNodeKind.Constant);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl or Constant in ArrayDecl: " + JSON.stringify(node));
  }
  const name = typeDecl.declname ?? "";
  const elementType = findTypeFromTypeDecl(typeDecl);
  const rawLength = constNode?.value;
  const length = rawLength && /^\d+$/.test(rawLength) ? parseInt(rawLength, 10) : 0;
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

  const typeDeclLeft = findParserNodeWithType(kids[0], ParserNodeKind.TypeDecl);
  const typeDeclRight = findParserNodeWithType(kids[1], ParserNodeKind.TypeDecl);

  const typeLeft = findTypeFromTypeDecl(typeDeclLeft);
  const typeRight = findTypeFromTypeDecl(typeDeclRight);

  const base = createNodeBase(ASTNodeTypes.BinaryExpression, {
    operator: bin.op,
    type: `${typeLeft}/${typeRight}`,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

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

/** Cast → ICastExpression */
export function convertCast(node: ParserNode): ICastExpression {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in Cast: " + JSON.stringify(node));
  }

  const targetType = findTypeFromTypeDecl(typeDecl);
  const base = createNodeBase(ASTNodeTypes.CastExpression, { targetType });
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

/** Decl → IVariableDeclaration */
export function convertDecl(node: ParserNode): IVariableDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in Decl: " + JSON.stringify(node));
  }

  const name = (node as IParserDeclNode).name;
  const type = findTypeFromTypeDecl(typeDecl);
  const base = createNodeBase(ASTNodeTypes.VariableDeclaration, {
    name,
    type,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** DoWhile → IDoWhileStatement */
export function convertDoWhile(node: ParserNode): IDoWhileStatement {
  const base = createNodeBase(ASTNodeTypes.DoWhileStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** FileAST → ITranslationUnit */
export function convertFileAST(node: ParserNode): ITranslationUnit {
  const base = createNodeBase(ASTNodeTypes.TranslationUnit);
  return wrapChildren(base, node, convertCParserNodes);
}

/** For → IForStatement */
export function convertFor(node: ParserNode): IForStatement {
  const base = createNodeBase(ASTNodeTypes.ForStatement);
  return wrapChildren(base, node, convertCParserNodes);
}

/** FuncDecl → IFunctionDeclaration */
export function convertFuncDecl(node: ParserNode): IFunctionDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in FuncDecl: " + JSON.stringify(node));
  }

  const name = typeDecl.declname ?? "";
  const returnType = findTypeFromTypeDecl(typeDecl);
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
  const returnType = findTypeFromTypeDecl(typeDecl);

  const functionName = typeDecl?.declname ?? "";
  const base = createNodeBase(ASTNodeTypes.FunctionDefinition, {
    name: functionName,
    returnType,
  });
  return wrapChildren(base, node, convertCParserNodes);
}

/** Goto → IGotoStatement */
export function convertGoto(node: ParserNode): IGotoStatement {
  const { name } = node as IParserGotoNode;
  const jumpTarget = typeof name === "string" ? name : "";
  const base = createNodeBase(ASTNodeTypes.GotoStatement, { jumpTarget });
  return wrapChildren(base, node, convertCParserNodes);
}

/** ID → IIdentifier */
export function convertID(node: ParserNode): IIdentifier {
  const { name } = node as IParserIDNode;
  const safeName = name ? name : "";
  const typeDeclNode = findParserNodeWithType(node, ParserNodeKind.TypeDecl);

  const type = findTypeFromTypeDecl(typeDeclNode);
  const base = createNodeBase(ASTNodeTypes.Identifier, {
    name: safeName,
    size: "undefined",
    type,
  });

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

/** PtrDecl → IPointerDeclaration */
export function convertPtrDecl(node: ParserNode): IPointerDeclaration {
  const typeDecl = findParserNodeWithType(node, ParserNodeKind.TypeDecl);
  if (!typeDecl) {
    throw new Error("Missing TypeDecl in PtrDecl: " + JSON.stringify(node));
  }

  const name = typeDecl.declname ?? "";

  const pointsTo = findTypeFromTypeDecl(typeDecl);

  const base = createNodeBase(ASTNodeTypes.PointerDeclaration, {
    level: 0,
    name,
    pointsTo,
  });
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

/** StructRef → IMemberAccess */
export function convertStructRef(node: ParserNode): IMemberAccess {
  const base = createNodeBase(ASTNodeTypes.MemberAccess, {
    type: "undefined",
  });
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
