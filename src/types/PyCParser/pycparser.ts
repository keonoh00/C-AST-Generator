// Auto-generated from embedded _c_ast.cfg

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
  kind: ParserKind.Alignas;
}


/** AST node for `ArrayDecl` */
export interface IParserArrayDeclNode extends ParserBaseASTNode {
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
  kind: ParserKind.ArrayRef;
  /** Child AST node */
  name: ParserASTNode;
  /** Child AST node */
  subscript: ParserASTNode;
}

/** AST node for `Assignment` */
export interface IParserAssignmentNode extends ParserBaseASTNode {
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
  kind: ParserKind.Break;

}

/** AST node for `Case` */
export interface IParserCaseNode extends ParserBaseASTNode {
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.Case;
  /** List of child AST nodes */
  stmts: ParserASTNode[];
}

/** AST node for `Cast` */
export interface IParserCastNode extends ParserBaseASTNode {
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.Cast;
  /** Child AST node */
  to_type: ParserASTNode;
}

/** AST node for `CompoundLiteral` */
export interface IParserCompoundLiteralNode extends ParserBaseASTNode {
  /** Child AST node */
  init: ParserASTNode;
  kind: ParserKind.CompoundLiteral;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Compound` */
export interface IParserCompoundNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  block_items: ParserASTNode[];
  kind: ParserKind.Compound;
}

/** AST node for `Constant` */
export interface IParserConstantNode extends ParserBaseASTNode {
  kind: ParserKind.Constant;
  /** Literal or attribute */
  type?: boolean | null | number | string;
  /** Literal or attribute */
  value?: boolean | null | number | string;
}

/** AST node for `Continue` */
export interface IParserContinueNode extends ParserBaseASTNode {
  kind: ParserKind.Continue;

}

/** AST node for `DeclList` */
export interface IParserDeclListNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  decls: ParserASTNode[];
  kind: ParserKind.DeclList;
}

/** AST node for `Decl` */
export interface IParserDeclNode extends ParserBaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  /** Child AST node */
  bitsize: ParserASTNode;
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
  kind: ParserKind.Default;
  /** List of child AST nodes */
  stmts: ParserASTNode[];
}

/** AST node for `DoWhile` */
export interface IParserDoWhileNode extends ParserBaseASTNode {
  /** Child AST node */
  cond: ParserASTNode;
  kind: ParserKind.DoWhile;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `EllipsisParam` */
export interface IParserEllipsisParamNode extends ParserBaseASTNode {
  kind: ParserKind.EllipsisParam;

}

/** AST node for `EmptyStatement` */
export interface IParserEmptyStatementNode extends ParserBaseASTNode {
  kind: ParserKind.EmptyStatement;

}

/** AST node for `EnumeratorList` */
export interface IParserEnumeratorListNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  enumerators: ParserASTNode[];
  kind: ParserKind.EnumeratorList;
}

/** AST node for `Enumerator` */
export interface IParserEnumeratorNode extends ParserBaseASTNode {
  kind: ParserKind.Enumerator;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  value: ParserASTNode;
}

/** AST node for `Enum` */
export interface IParserEnumNode extends ParserBaseASTNode {
  kind: ParserKind.Enum;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  values: ParserASTNode;
}

/** AST node for `ExprList` */
export interface IParserExprListNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  exprs: ParserASTNode[];
  kind: ParserKind.ExprList;
}

/** AST node for `FileAST` */
export interface IParserFileASTNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  ext: ParserASTNode[];
  kind: ParserKind.FileAST;
}

/** AST node for `For` */
export interface IParserForNode extends ParserBaseASTNode {
  /** Child AST node */
  cond: ParserASTNode;
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
  kind: ParserKind.FuncCall;
  /** Child AST node */
  name: ParserASTNode;
}

/** AST node for `FuncDecl` */
export interface IParserFuncDeclNode extends ParserBaseASTNode {
  /** Child AST node */
  args: ParserASTNode;
  kind: ParserKind.FuncDecl;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `FuncDef` */
export interface IParserFuncDefNode extends ParserBaseASTNode {
  /** Child AST node */
  body: ParserASTNode;
  /** Child AST node */
  decl: ParserASTNode;
  kind: ParserKind.FuncDef;
  /** List of child AST nodes */
  param_decls: ParserASTNode[];
}

/** AST node for `Goto` */
export interface IParserGotoNode extends ParserBaseASTNode {
  kind: ParserKind.Goto;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `IdentifierType` */
export interface IParserIdentifierTypeNode extends ParserBaseASTNode {
  kind: ParserKind.IdentifierType;
  /** Literal or attribute */
  names?: boolean | null | number | string;
}

/** AST node for `ID` */
export interface IParserIDNode extends ParserBaseASTNode {
  kind: ParserKind.ID;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `If` */
export interface IParserIfNode extends ParserBaseASTNode {
  /** Child AST node */
  cond: ParserASTNode;
  /** Child AST node */
  iffalse: ParserASTNode;
  /** Child AST node */
  iftrue: ParserASTNode;
  kind: ParserKind.If;
}

/** AST node for `InitList` */
export interface IParserInitListNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  exprs: ParserASTNode[];
  kind: ParserKind.InitList;
}

/** AST node for `Label` */
export interface IParserLabelNode extends ParserBaseASTNode {
  kind: ParserKind.Label;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `NamedInitializer` */
export interface IParserNamedInitializerNode extends ParserBaseASTNode {
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.NamedInitializer;
  /** List of child AST nodes */
  name: ParserASTNode[];
}

/** AST node for `ParamList` */
export interface IParserParamListNode extends ParserBaseASTNode {
  kind: ParserKind.ParamList;
  /** List of child AST nodes */
  params: ParserASTNode[];
}

/** AST node for `Pragma` */
export interface IParserPragmaNode extends ParserBaseASTNode {
  kind: ParserKind.Pragma;
  /** Literal or attribute */
  string?: boolean | null | number | string;
}

/** AST node for `PtrDecl` */
export interface IParserPtrDeclNode extends ParserBaseASTNode {
  kind: ParserKind.PtrDecl;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ParserASTNode;
}

/** AST node for `Return` */
export interface IParserReturnNode extends ParserBaseASTNode {
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.Return;
}

/** AST node for `StaticAssert` */
export interface IParserStaticAssertNode extends ParserBaseASTNode {
  /** Child AST node */
  cond: ParserASTNode;
  kind: ParserKind.StaticAssert;
  /** Child AST node */
  message: ParserASTNode;
}

/** AST node for `Struct` */
export interface IParserStructNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  decls: ParserASTNode[];
  kind: ParserKind.Struct;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `StructRef` */
export interface IParserStructRefNode extends ParserBaseASTNode {
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
  /** Child AST node */
  cond: ParserASTNode;
  kind: ParserKind.Switch;
  /** Child AST node */
  stmt: ParserASTNode;
}

/** AST node for `TernaryOp` */
export interface IParserTernaryOpNode extends ParserBaseASTNode {
  /** Child AST node */
  cond: ParserASTNode;
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
  /** Child AST node */
  expr: ParserASTNode;
  kind: ParserKind.UnaryOp;
  /** Literal or attribute */
  op?: boolean | null | number | string;
}

/** AST node for `Union` */
export interface IParserUnionNode extends ParserBaseASTNode {
  /** List of child AST nodes */
  decls: ParserASTNode[];
  kind: ParserKind.Union;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `While` */
export interface IParserWhileNode extends ParserBaseASTNode {
  /** Child AST node */
  cond: ParserASTNode;
  kind: ParserKind.While;
  /** Child AST node */
  stmt: ParserASTNode;
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

export type ParserASTNodeArray = ParserASTNode[];

export interface ParserBaseASTNode {
  [key: string]: boolean | null | number | ParserASTNode | ParserASTNode[] | string | undefined;
  coord?: string;
}