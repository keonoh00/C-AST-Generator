// Auto‐generated from embedded _c_ast.cfg

export enum ParserKind {
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

/** AST node for `Alignas` */
export interface IParserAlignasNode extends ParserBaseASTNode {
  /** Child AST node */
  alignment: ParserASTNode;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Alignas;
}


/** AST node for `ArrayDecl` */
export interface IParserArrayDeclNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  dim: ParserASTNode;
  /** Literal or attribute */
  dim_quals?: boolean | null | number | string;
  kind: ParserKind.ArrayDecl;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `ArrayRef` */
export interface IParserArrayRefNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.ArrayRef;
  /** Child AST node */
  name: ParserASTNode;
  /** Child AST node */
  subscript: ParserASTNode;
}

/** AST node for `Assignment` */
export interface IParserAssignmentNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Assignment;
  /** Child AST node */
  lvalue: ParserASTNode;
  /** Literal or attribute */
  op?: boolean | null | number | string;
  /** Child AST node */
  rvalue: ParserASTNode;
}

/** AST node for `BinaryOp` */
export interface IParserBinaryOpNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.BinaryOp;
  /** Child AST node */
  left: ParserASTNode;
  /** Literal or attribute */
  op?: boolean | null | number | string;
  /** Child AST node */
  right: ParserASTNode;
}

/** AST node for `Break` */
export interface IParserBreakNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Break;
}

/** AST node for `Case` */
export interface IParserCaseNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.Case;
  /** Sequence of child AST nodes */
  stmts: ParserASTNode[];
}

/** AST node for `Cast` */
export interface IParserCastNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.Cast;
  /** Child AST node */
  to_type: ParserASTNode;
}

/** AST node for `CompoundLiteral` */
export interface IParserCompoundLiteralNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  init: ParserASTNode;
  kind: ParserKind.CompoundLiteral;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Compound` */
export interface IParserCompoundNode extends ParserBaseASTNode {
  /** Sequence of child AST nodes */
  block_items: ParserASTNode[];
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Compound;
}

/** AST node for `Constant` */
export interface IParserConstantNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Constant;
  /** Literal or attribute */
  type?: boolean | null | number | string;
  /** Literal or attribute */
  value?: boolean | null | number | string;
}

/** AST node for `Continue` */
export interface IParserContinueNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Continue;
}

/** AST node for `DeclList` */
export interface IParserDeclListNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  decls: ParserASTNode[];
  kind: ParserKind.DeclList;
}

/** AST node for `Decl` */
export interface IParserDeclNode extends ParserBaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  /** Child AST node */
  bitsize: ParserASTNode;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Literal or attribute */
  funcspec?: boolean | null | number | string;
  /** Child AST node */
  init: ParserASTNode;
  kind: ParserKind.Decl;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Literal or attribute */
  storage?: boolean | null | number | string;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Default` */
export interface IParserDefaultNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Default;
  /** Sequence of child AST nodes */
  stmts: ParserASTNode[];
}

/** AST node for `DoWhile` */
export interface IParserDoWhileNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.DoWhile;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `EllipsisParam` */
export interface IParserEllipsisParamNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.EllipsisParam;
}

/** AST node for `EmptyStatement` */
export interface IParserEmptyStatementNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.EmptyStatement;
}

/** AST node for `EnumeratorList` */
export interface IParserEnumeratorListNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  enumerators: ParserASTNode[];
  kind: ParserKind.EnumeratorList;
}

/** AST node for `Enumerator` */
export interface IParserEnumeratorNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Enumerator;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  value: ParserASTNode;
}

/** AST node for `Enum` */
export interface IParserEnumNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Enum;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  values: ParserASTNode;
}

/** AST node for `ExprList` */
export interface IParserExprListNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  exprs: ParserASTNode[];
  kind: ParserKind.ExprList;
}

/** AST node for `FileAST` */
export interface IParserFileASTNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  ext: ParserASTNode[];
  kind: ParserKind.FileAST;
}

/** AST node for `For` */
export interface IParserForNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  init: ParserASTNode;
  kind: ParserKind.For;
  /** Child AST node */
  next: ParserASTNode;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `FuncCall` */
export interface IParserFuncCallNode extends ParserBaseASTNode {
  /** Child AST node */
  args: ParserASTNode;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.FuncCall;
  /** Child AST node */
  name: ParserASTNode;
}

/** AST node for `FuncDecl` */
export interface IParserFuncDeclNode extends ParserBaseASTNode {
  /** Child AST node */
  args: ParserASTNode;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.FuncDecl;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `FuncDef` */
export interface IParserFuncDefNode extends ParserBaseASTNode {
  /** Child AST node */
  body: ParserASTNode;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  decl: ParserASTNode;
  kind: ParserKind.FuncDef;
  /** Sequence of child AST nodes */
  param_decls: ParserASTNode[];
}

/** AST node for `Goto` */
export interface IParserGotoNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Goto;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `IdentifierType` */
export interface IParserIdentifierTypeNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.IdentifierType;
  /** Literal or attribute */
  names?: boolean | null | number | string;
}

/** AST node for `ID` */
export interface IParserIDNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.ID;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `If` */
export interface IParserIfNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  iffalse: ParserASTNode;
  /** Child AST node */
  iftrue: ParserASTNode;
  kind: ParserKind.If;
}

/** AST node for `InitList` */
export interface IParserInitListNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  exprs: ParserASTNode[];
  kind: ParserKind.InitList;
}

/** AST node for `Label` */
export interface IParserLabelNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Label;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `NamedInitializer` */
export interface IParserNamedInitializerNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.NamedInitializer;
  /** Sequence of child AST nodes */
  name: ParserASTNode[];
}

/** AST node for `ParamList` */
export interface IParserParamListNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.ParamList;
  /** Sequence of child AST nodes */
  params: ParserASTNode[];
}

/** AST node for `Pragma` */
export interface IParserPragmaNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Pragma;
  /** Literal or attribute */
  string?: boolean | null | number | string;
}

/** AST node for `PtrDecl` */
export interface IParserPtrDeclNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.PtrDecl;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Return` */
export interface IParserReturnNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.Return;
}

/** AST node for `StaticAssert` */
export interface IParserStaticAssertNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.StaticAssert;
  /** Child AST node */
  message: ParserASTNode;
}

/** AST node for `Struct` */
export interface IParserStructNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  decls: ParserASTNode[];
  kind: ParserKind.Struct;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `StructRef` */
export interface IParserStructRefNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  field: ParserASTNode;
  kind: ParserKind.StructRef;
  /** Child AST node */
  name: ParserASTNode;
  /** Literal or attribute */
  type?: boolean | null | number | string;
}

/** AST node for `Switch` */
export interface IParserSwitchNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Switch;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `TernaryOp` */
export interface IParserTernaryOpNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  iffalse: ParserASTNode;
  /** Child AST node */
  iftrue: ParserASTNode;
  kind: ParserKind.TernaryOp;
}

/** AST node for `TypeDecl` */
export interface IParserTypeDeclNode extends ParserBaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Literal or attribute */
  declname?: boolean | null | number | string;
  kind: ParserKind.TypeDecl;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Typedef` */
export interface IParserTypedefNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Typedef;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Literal or attribute */
  storage?: boolean | null | number | string;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Typename` */
export interface IParserTypenameNode extends ParserBaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.Typename;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `UnaryOp` */
export interface IParserUnaryOpNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.UnaryOp;
  /** Literal or attribute */
  op?: boolean | null | number | string;
}

/** AST node for `Union` */
export interface IParserUnionNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  /** Sequence of child AST nodes */
  decls: ParserASTNode[];
  kind: ParserKind.Union;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `While` */
export interface IParserWhileNode extends ParserBaseASTNode {
  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];
  /** Child AST node */
  cond: ParserASTNode;
  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
  kind: ParserKind.While;
  /** Child AST node */
  stmt: ParserASTNode;
}

export interface KindToNodeMap {
  [ParserKind.Alignas]: IParserAlignasNode;
  [ParserKind.ArrayDecl]: IParserArrayDeclNode;
  [ParserKind.ArrayRef]: IParserArrayRefNode;
  [ParserKind.Assignment]: IParserAssignmentNode;
  [ParserKind.BinaryOp]: IParserBinaryOpNode;
  [ParserKind.Break]: IParserBreakNode;
  [ParserKind.Case]: IParserCaseNode;
  [ParserKind.Cast]: IParserCastNode;
  [ParserKind.Compound]: IParserCompoundNode;
  [ParserKind.CompoundLiteral]: IParserCompoundLiteralNode;
  [ParserKind.Constant]: IParserConstantNode;
  [ParserKind.Continue]: IParserContinueNode;
  [ParserKind.Decl]: IParserDeclNode;
  [ParserKind.DeclList]: IParserDeclListNode;
  [ParserKind.Default]: IParserDefaultNode;
  [ParserKind.DoWhile]: IParserDoWhileNode;
  [ParserKind.EllipsisParam]: IParserEllipsisParamNode;
  [ParserKind.EmptyStatement]: IParserEmptyStatementNode;
  [ParserKind.Enum]: IParserEnumNode;
  [ParserKind.Enumerator]: IParserEnumeratorNode;
  [ParserKind.EnumeratorList]: IParserEnumeratorListNode;
  [ParserKind.ExprList]: IParserExprListNode;
  [ParserKind.FileAST]: IParserFileASTNode;
  [ParserKind.For]: IParserForNode;
  [ParserKind.FuncCall]: IParserFuncCallNode;
  [ParserKind.FuncDecl]: IParserFuncDeclNode;
  [ParserKind.FuncDef]: IParserFuncDefNode;
  [ParserKind.Goto]: IParserGotoNode;
  [ParserKind.ID]: IParserIDNode;
  [ParserKind.IdentifierType]: IParserIdentifierTypeNode;
  [ParserKind.If]: IParserIfNode;
  [ParserKind.InitList]: IParserInitListNode;
  [ParserKind.Label]: IParserLabelNode;
  [ParserKind.NamedInitializer]: IParserNamedInitializerNode;
  [ParserKind.ParamList]: IParserParamListNode;
  [ParserKind.Pragma]: IParserPragmaNode;
  [ParserKind.PtrDecl]: IParserPtrDeclNode;
  [ParserKind.Return]: IParserReturnNode;
  [ParserKind.StaticAssert]: IParserStaticAssertNode;
  [ParserKind.Struct]: IParserStructNode;
  [ParserKind.StructRef]: IParserStructRefNode;
  [ParserKind.Switch]: IParserSwitchNode;
  [ParserKind.TernaryOp]: IParserTernaryOpNode;
  [ParserKind.TypeDecl]: IParserTypeDeclNode;
  [ParserKind.Typedef]: IParserTypedefNode;
  [ParserKind.Typename]: IParserTypenameNode;
  [ParserKind.UnaryOp]: IParserUnaryOpNode;
  [ParserKind.Union]: IParserUnionNode;
  [ParserKind.While]: IParserWhileNode;
}

export type ParserASTNode =
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

export interface ParserBaseASTNode {
  /**
   * Anything else (literal fields, names, qualifiers, qualifiers, etc.)
   * may be a primitive or a single AST node, but never an array.
   */
  [key: string]: boolean | null | number | ParserASTNode | ParserASTNode[] | string | undefined;

  /** All nested child nodes (zero, one, or many) */
  children?: ParserASTNode[];

  /** Source coordinate, e.g. "file.c:23:5" */
  coord: string;
}
