export enum ParserNodeKind {
  Alignas = "Alignas",
  ArrayDecl = "ArrayDecl",
  ArrayRef = "ArrayRef",
  Assignment = "Assignment",
  BinaryOp = "BinaryOp",
  Break = "Break",
  Case = "Case",
  Cast = "Cast",
  Compound = "Compound",
  CompoundLiteral = "CompoundLiteral",
  Constant = "Constant",
  Continue = "Continue",
  Decl = "Decl",
  DeclList = "DeclList",
  Default = "Default",
  DoWhile = "DoWhile",
  EllipsisParam = "EllipsisParam",
  EmptyStatement = "EmptyStatement",
  Enum = "Enum",
  Enumerator = "Enumerator",
  EnumeratorList = "EnumeratorList",
  ExprList = "ExprList",
  FileAST = "FileAST",
  For = "For",
  FuncCall = "FuncCall",
  FuncDecl = "FuncDecl",
  FuncDef = "FuncDef",
  Goto = "Goto",
  ID = "ID",
  IdentifierType = "IdentifierType",
  If = "If",
  InitList = "InitList",
  Label = "Label",
  NamedInitializer = "NamedInitializer",
  ParamList = "ParamList",
  Pragma = "Pragma",
  PtrDecl = "PtrDecl",
  Return = "Return",
  StaticAssert = "StaticAssert",
  Struct = "Struct",
  StructRef = "StructRef",
  Switch = "Switch",
  TernaryOp = "TernaryOp",
  TypeDecl = "TypeDecl",
  Typedef = "Typedef",
  Typename = "Typename",
  UnaryOp = "UnaryOp",
  Union = "Union",
  While = "While",
}

export interface IParserAlignasNode extends IParserBaseNode {
  alignment: null | ParserNode;
  kind: ParserNodeKind.Alignas;
}

export interface IParserArrayDeclNode extends IParserBaseNode {
  dim: null | ParserNode;
  dim_quals: string[];
  kind: ParserNodeKind.ArrayDecl;
  type: null | ParserNode;
}
export interface IParserArrayRefNode extends IParserBaseNode {
  kind: ParserNodeKind.ArrayRef;
  name: null | ParserNode;
  subscript: null | ParserNode;
}
export interface IParserAssignmentNode extends IParserBaseNode {
  kind: ParserNodeKind.Assignment;
  lvalue: null | ParserNode;
  op: string;
  rvalue: null | ParserNode;
}
export interface IParserBinaryOpNode extends IParserBaseNode {
  kind: ParserNodeKind.BinaryOp;
  left: null | ParserNode;
  op: string;
  right: null | ParserNode;
}
export interface IParserBreakNode extends IParserBaseNode {
  kind: ParserNodeKind.Break;
}
export interface IParserCaseNode extends IParserBaseNode {
  expr: null | ParserNode;
  kind: ParserNodeKind.Case;
  stmts: ParserNode[];
}
export interface IParserCastNode extends IParserBaseNode {
  expr: null | ParserNode;
  kind: ParserNodeKind.Cast;
  to_type: null | ParserNode;
}
export interface IParserCompoundLiteralNode extends IParserBaseNode {
  init: null | ParserNode;
  kind: ParserNodeKind.CompoundLiteral;
  type: null | ParserNode;
}
export interface IParserCompoundNode extends IParserBaseNode {
  block_items: ParserNode[];
  kind: ParserNodeKind.Compound;
}
export interface IParserConstantNode extends IParserBaseNode {
  kind: ParserNodeKind.Constant;
  type: string;
  value: string;
}
export interface IParserContinueNode extends IParserBaseNode {
  kind: ParserNodeKind.Continue;
}
export interface IParserDeclListNode extends IParserBaseNode {
  decls: ParserNode[];
  kind: ParserNodeKind.DeclList;
}
export interface IParserDeclNode extends IParserBaseNode {
  align?: null | ParserNode;
  bitsize?: null | ParserNode;
  funcspec: string[];
  init?: null | ParserNode;
  kind: ParserNodeKind.Decl;
  name: string;
  quals: string[];
  storage: string[];
  type: null | ParserNode;
}
export interface IParserDefaultNode extends IParserBaseNode {
  kind: ParserNodeKind.Default;
  stmts: ParserNode[];
}
export interface IParserDoWhileNode extends IParserBaseNode {
  cond: null | ParserNode;
  kind: ParserNodeKind.DoWhile;
  stmt: null | ParserNode;
}
export interface IParserEllipsisParamNode extends IParserBaseNode {
  kind: ParserNodeKind.EllipsisParam;
}
export interface IParserEmptyStatementNode extends IParserBaseNode {
  kind: ParserNodeKind.EmptyStatement;
}
export interface IParserEnumeratorListNode extends IParserBaseNode {
  enumerators: ParserNode[];
  kind: ParserNodeKind.EnumeratorList;
}
export interface IParserEnumeratorNode extends IParserBaseNode {
  kind: ParserNodeKind.Enumerator;
  name: string;
  value?: null | ParserNode;
}
export interface IParserEnumNode extends IParserBaseNode {
  kind: ParserNodeKind.Enum;
  name?: string;
  values: null | ParserNode;
}
export interface IParserExprListNode extends IParserBaseNode {
  exprs: ParserNode[];
  kind: ParserNodeKind.ExprList;
}
export interface IParserFileASTNode extends IParserBaseNode {
  ext: ParserNode[];
  kind: ParserNodeKind.FileAST;
}
export interface IParserForNode extends IParserBaseNode {
  cond?: null | ParserNode;
  init?: null | ParserNode;
  kind: ParserNodeKind.For;
  next?: null | ParserNode;
  stmt: null | ParserNode;
}
export interface IParserFuncCallNode extends IParserBaseNode {
  args?: null | ParserNode;
  kind: ParserNodeKind.FuncCall;
  name: null | ParserNode;
}
export interface IParserFuncDeclNode extends IParserBaseNode {
  args?: null | ParserNode;
  kind: ParserNodeKind.FuncDecl;
  type: null | ParserNode;
}
export interface IParserFuncDefNode extends IParserBaseNode {
  body: null | ParserNode;
  decl: null | ParserNode;
  kind: ParserNodeKind.FuncDef;
  param_decls: ParserNode[];
}
export interface IParserGotoNode extends IParserBaseNode {
  kind: ParserNodeKind.Goto;
  name: string;
}
export interface IParserIdentifierTypeNode extends IParserBaseNode {
  kind: ParserNodeKind.IdentifierType;
  names: string[];
}
export interface IParserIDNode extends IParserBaseNode {
  kind: ParserNodeKind.ID;
  name: string;
}
export interface IParserIfNode extends IParserBaseNode {
  cond: null | ParserNode;
  iffalse?: null | ParserNode;
  iftrue: null | ParserNode;
  kind: ParserNodeKind.If;
}
export interface IParserInitListNode extends IParserBaseNode {
  exprs: ParserNode[];
  kind: ParserNodeKind.InitList;
}
export interface IParserLabelNode extends IParserBaseNode {
  kind: ParserNodeKind.Label;
  name: string;
  stmt: null | ParserNode;
}
export interface IParserNamedInitializerNode extends IParserBaseNode {
  expr: null | ParserNode;
  kind: ParserNodeKind.NamedInitializer;
  name: ParserNode[];
}
export interface IParserParamListNode extends IParserBaseNode {
  kind: ParserNodeKind.ParamList;
  params: ParserNode[];
}
export interface IParserPragmaNode extends IParserBaseNode {
  kind: ParserNodeKind.Pragma;
  string: string;
}
export interface IParserPtrDeclNode extends IParserBaseNode {
  kind: ParserNodeKind.PtrDecl;
  quals: string[];
  type: null | ParserNode;
}
export interface IParserReturnNode extends IParserBaseNode {
  expr?: null | ParserNode;
  kind: ParserNodeKind.Return;
}
export interface IParserStaticAssertNode extends IParserBaseNode {
  cond: null | ParserNode;
  kind: ParserNodeKind.StaticAssert;
  message: null | ParserNode;
}
export interface IParserStructNode extends IParserBaseNode {
  decls: ParserNode[];
  kind: ParserNodeKind.Struct;
  name?: string;
}
export interface IParserStructRefNode extends IParserBaseNode {
  field: null | ParserNode;
  kind: ParserNodeKind.StructRef;
  name: null | ParserNode;
  type: "->" | ".";
}
export interface IParserSwitchNode extends IParserBaseNode {
  cond: null | ParserNode;
  kind: ParserNodeKind.Switch;
  stmt: null | ParserNode;
}
export interface IParserTernaryOpNode extends IParserBaseNode {
  cond: null | ParserNode;
  iffalse: null | ParserNode;
  iftrue: null | ParserNode;
  kind: ParserNodeKind.TernaryOp;
}
export interface IParserTypeDeclNode extends IParserBaseNode {
  align?: null | ParserNode;
  declname?: string;
  kind: ParserNodeKind.TypeDecl;
  quals: string[];
  type: null | ParserNode;
}
export interface IParserTypedefNode extends IParserBaseNode {
  kind: ParserNodeKind.Typedef;
  name: string;
  quals: string[];
  storage: string[];
  type: null | ParserNode;
}
export interface IParserTypenameNode extends IParserBaseNode {
  align?: null | ParserNode;
  kind: ParserNodeKind.Typename;
  name?: string;
  quals: string[];
  type: null | ParserNode;
}
export interface IParserUnaryOpNode extends IParserBaseNode {
  expr: null | ParserNode;
  kind: ParserNodeKind.UnaryOp;
  op: string;
}
export interface IParserUnionNode extends IParserBaseNode {
  decls: ParserNode[];
  kind: ParserNodeKind.Union;
  name?: string;
}
export interface IParserWhileNode extends IParserBaseNode {
  cond: null | ParserNode;
  kind: ParserNodeKind.While;
  stmt: null | ParserNode;
}
export interface KindToNodeMap {
  [ParserNodeKind.Alignas]: IParserAlignasNode;
  [ParserNodeKind.ArrayDecl]: IParserArrayDeclNode;
  [ParserNodeKind.ArrayRef]: IParserArrayRefNode;
  [ParserNodeKind.Assignment]: IParserAssignmentNode;
  [ParserNodeKind.BinaryOp]: IParserBinaryOpNode;
  [ParserNodeKind.Break]: IParserBreakNode;
  [ParserNodeKind.Case]: IParserCaseNode;
  [ParserNodeKind.Cast]: IParserCastNode;
  [ParserNodeKind.Compound]: IParserCompoundNode;
  [ParserNodeKind.CompoundLiteral]: IParserCompoundLiteralNode;
  [ParserNodeKind.Constant]: IParserConstantNode;
  [ParserNodeKind.Continue]: IParserContinueNode;
  [ParserNodeKind.Decl]: IParserDeclNode;
  [ParserNodeKind.DeclList]: IParserDeclListNode;
  [ParserNodeKind.Default]: IParserDefaultNode;
  [ParserNodeKind.DoWhile]: IParserDoWhileNode;
  [ParserNodeKind.EllipsisParam]: IParserEllipsisParamNode;
  [ParserNodeKind.EmptyStatement]: IParserEmptyStatementNode;
  [ParserNodeKind.Enum]: IParserEnumNode;
  [ParserNodeKind.Enumerator]: IParserEnumeratorNode;
  [ParserNodeKind.EnumeratorList]: IParserEnumeratorListNode;
  [ParserNodeKind.ExprList]: IParserExprListNode;
  [ParserNodeKind.FileAST]: IParserFileASTNode;
  [ParserNodeKind.For]: IParserForNode;
  [ParserNodeKind.FuncCall]: IParserFuncCallNode;
  [ParserNodeKind.FuncDecl]: IParserFuncDeclNode;
  [ParserNodeKind.FuncDef]: IParserFuncDefNode;
  [ParserNodeKind.Goto]: IParserGotoNode;
  [ParserNodeKind.ID]: IParserIDNode;
  [ParserNodeKind.IdentifierType]: IParserIdentifierTypeNode;
  [ParserNodeKind.If]: IParserIfNode;
  [ParserNodeKind.InitList]: IParserInitListNode;
  [ParserNodeKind.Label]: IParserLabelNode;
  [ParserNodeKind.NamedInitializer]: IParserNamedInitializerNode;
  [ParserNodeKind.ParamList]: IParserParamListNode;
  [ParserNodeKind.Pragma]: IParserPragmaNode;
  [ParserNodeKind.PtrDecl]: IParserPtrDeclNode;
  [ParserNodeKind.Return]: IParserReturnNode;
  [ParserNodeKind.StaticAssert]: IParserStaticAssertNode;
  [ParserNodeKind.Struct]: IParserStructNode;
  [ParserNodeKind.StructRef]: IParserStructRefNode;
  [ParserNodeKind.Switch]: IParserSwitchNode;
  [ParserNodeKind.TernaryOp]: IParserTernaryOpNode;
  [ParserNodeKind.TypeDecl]: IParserTypeDeclNode;
  [ParserNodeKind.Typedef]: IParserTypedefNode;
  [ParserNodeKind.Typename]: IParserTypenameNode;
  [ParserNodeKind.UnaryOp]: IParserUnaryOpNode;
  [ParserNodeKind.Union]: IParserUnionNode;
  [ParserNodeKind.While]: IParserWhileNode;
}

export type ParserNode =
  | IParserAlignasNode
  | IParserArrayDeclNode
  | IParserArrayRefNode
  | IParserAssignmentNode
  | IParserBinaryOpNode
  | IParserBreakNode
  | IParserCaseNode
  | IParserCastNode
  | IParserCompoundLiteralNode
  | IParserCompoundNode
  | IParserConstantNode
  | IParserContinueNode
  | IParserDeclListNode
  | IParserDeclNode
  | IParserDefaultNode
  | IParserDoWhileNode
  | IParserEllipsisParamNode
  | IParserEmptyStatementNode
  | IParserEnumeratorListNode
  | IParserEnumeratorNode
  | IParserEnumNode
  | IParserExprListNode
  | IParserFileASTNode
  | IParserForNode
  | IParserFuncCallNode
  | IParserFuncDeclNode
  | IParserFuncDefNode
  | IParserGotoNode
  | IParserIdentifierTypeNode
  | IParserIDNode
  | IParserIfNode
  | IParserInitListNode
  | IParserLabelNode
  | IParserNamedInitializerNode
  | IParserParamListNode
  | IParserPragmaNode
  | IParserPtrDeclNode
  | IParserReturnNode
  | IParserStaticAssertNode
  | IParserStructNode
  | IParserStructRefNode
  | IParserSwitchNode
  | IParserTernaryOpNode
  | IParserTypeDeclNode
  | IParserTypedefNode
  | IParserTypenameNode
  | IParserUnaryOpNode
  | IParserUnionNode
  | IParserWhileNode;

interface IParserBaseNode {
  children?: ParserNode[];
  coord?: string;
  kind: ParserNodeKind;
}
