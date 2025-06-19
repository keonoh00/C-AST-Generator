import { ASTNodes } from "../node";

export enum ASTNodeTypes {
  AddressOfExpression = "AddressOfExpression",
  ArrayDeclaration = "ArrayDeclaration",
  ArraySizeAllocation = "ArraySizeAllocation",
  ArraySubscriptionExpression = "ArraySubscriptionExpression",
  AssignmentExpression = "AssignmentExpression",
  BinaryExpression = "BinaryExpression",
  BreakStatement = "BreakStatement",
  CastExpression = "CastExpression",
  CompoundStatement = "CompoundStatement",
  ContinueStatement = "ContinueStatement",
  DoWhileStatement = "DoWhileStatement",
  EnumType = "EnumType",
  ForStatement = "ForStatement",
  FunctionDeclaration = "FunctionDeclaration",
  FunctionDefinition = "FunctionDefinition",
  GotoStatement = "GotoStatement",
  Identifier = "Identifier",
  IfStatement = "IfStatement",
  IncludeDirective = "IncludeDirective",
  Label = "Label",
  Literal = "Literal",
  MacroDefinition = "MacroDefinition",
  MemberAccess = "MemberAccess",
  ParameterDeclaration = "ParameterDeclaration",
  ParameterList = "ParameterList",
  PointerDeclaration = "PointerDeclaration",
  PointerDereference = "PointerDereference",
  ReturnStatement = "ReturnStatement",
  SizeOfExpression = "SizeOfExpression",
  StandardLibCall = "StandardLibCall",
  StructType = "StructType",
  SwitchCase = "SwitchCase",
  SwitchStatement = "SwitchStatement",
  TranslationUnit = "TranslationUnit",
  TypeDefinition = "TypeDefinition",
  UnaryExpression = "UnaryExpression",
  UnionType = "UnionType",
  UserDefinedCall = "UserDefinedCall",
  VariableDeclaration = "VariableDeclaration",
  WhileStatement = "WhileStatement",
}

export interface IBaseNode {
  children?: ASTNodes[];
  id: number;
  nodeType: ASTNodeTypes;
}
