// Auto-generated from embedded _c_ast.cfg

export enum Kind {
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
export interface AlignasNode extends BaseASTNode {
  /** Child AST node */
  alignment: ASTNode;
  kind: Kind.Alignas;
}

/** AST node for `ArrayDecl` */
export interface ArrayDeclNode extends BaseASTNode {
  /** Child AST node */
  dim: ASTNode;
  /** Literal or attribute */
  dim_quals?: boolean | null | number | string;
  kind: Kind.ArrayDecl;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `ArrayRef` */
export interface ArrayRefNode extends BaseASTNode {
  kind: Kind.ArrayRef;
  /** Child AST node */
  name: ASTNode;
  /** Child AST node */
  subscript: ASTNode;
}

/** AST node for `Assignment` */
export interface AssignmentNode extends BaseASTNode {
  kind: Kind.Assignment;
  /** Child AST node */
  lvalue: ASTNode;
  /** Literal or attribute */
  op?: boolean | null | number | string;
  /** Child AST node */
  rvalue: ASTNode;
}

export type ASTNode =
  | AlignasNode
  | ArrayDeclNode
  | ArrayRefNode
  | AssignmentNode
  | BinaryOpNode
  | BreakNode
  | CaseNode
  | CastNode
  | CompoundLiteralNode
  | CompoundNode
  | ConstantNode
  | ContinueNode
  | DeclListNode
  | DeclNode
  | DefaultNode
  | DoWhileNode
  | EllipsisParamNode
  | EmptyStatementNode
  | EnumeratorListNode
  | EnumeratorNode
  | EnumNode
  | ExprListNode
  | FileASTNode
  | ForNode
  | FuncCallNode
  | FuncDeclNode
  | FuncDefNode
  | GotoNode
  | IdentifierTypeNode
  | IDNode
  | IfNode
  | InitListNode
  | LabelNode
  | NamedInitializerNode
  | ParamListNode
  | PragmaNode
  | PtrDeclNode
  | ReturnNode
  | StaticAssertNode
  | StructNode
  | StructRefNode
  | SwitchNode
  | TernaryOpNode
  | TypeDeclNode
  | TypedefNode
  | TypenameNode
  | UnaryOpNode
  | UnionNode
  | WhileNode;

export interface BaseASTNode {
  [key: string]: ASTNode | ASTNode[] | boolean | null | number | string | undefined;
  coord?: string;
}

/** AST node for `BinaryOp` */
export interface BinaryOpNode extends BaseASTNode {
  kind: Kind.BinaryOp;
  /** Child AST node */
  left: ASTNode;
  /** Literal or attribute */
  op?: boolean | null | number | string;
  /** Child AST node */
  right: ASTNode;
}

/** AST node for `Break` */
export interface BreakNode extends BaseASTNode {
  kind: Kind.Break;
}

/** AST node for `Case` */
export interface CaseNode extends BaseASTNode {
  /** Child AST node */
  expr: ASTNode;
  kind: Kind.Case;
  /** List of child AST nodes */
  stmts: ASTNode[];
}

/** AST node for `Cast` */
export interface CastNode extends BaseASTNode {
  /** Child AST node */
  expr: ASTNode;
  kind: Kind.Cast;
  /** Child AST node */
  to_type: ASTNode;
}

/** AST node for `CompoundLiteral` */
export interface CompoundLiteralNode extends BaseASTNode {
  /** Child AST node */
  init: ASTNode;
  kind: Kind.CompoundLiteral;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `Compound` */
export interface CompoundNode extends BaseASTNode {
  /** List of child AST nodes */
  block_items: ASTNode[];
  kind: Kind.Compound;
}

/** AST node for `Constant` */
export interface ConstantNode extends BaseASTNode {
  kind: Kind.Constant;
  /** Literal or attribute */
  type?: boolean | null | number | string;
  /** Literal or attribute */
  value?: boolean | null | number | string;
}

/** AST node for `Continue` */
export interface ContinueNode extends BaseASTNode {
  kind: Kind.Continue;
}

/** AST node for `DeclList` */
export interface DeclListNode extends BaseASTNode {
  /** List of child AST nodes */
  decls: ASTNode[];
  kind: Kind.DeclList;
}

/** AST node for `Decl` */
export interface DeclNode extends BaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  /** Child AST node */
  bitsize: ASTNode;
  /** Literal or attribute */
  funcspec?: boolean | null | number | string;
  /** Child AST node */
  init: ASTNode;
  kind: Kind.Decl;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Literal or attribute */
  storage?: boolean | null | number | string;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `Default` */
export interface DefaultNode extends BaseASTNode {
  kind: Kind.Default;
  /** List of child AST nodes */
  stmts: ASTNode[];
}

/** AST node for `DoWhile` */
export interface DoWhileNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  kind: Kind.DoWhile;
  /** Child AST node */
  stmt: ASTNode;
}

/** AST node for `EllipsisParam` */
export interface EllipsisParamNode extends BaseASTNode {
  kind: Kind.EllipsisParam;
}

/** AST node for `EmptyStatement` */
export interface EmptyStatementNode extends BaseASTNode {
  kind: Kind.EmptyStatement;
}

/** AST node for `EnumeratorList` */
export interface EnumeratorListNode extends BaseASTNode {
  /** List of child AST nodes */
  enumerators: ASTNode[];
  kind: Kind.EnumeratorList;
}

/** AST node for `Enumerator` */
export interface EnumeratorNode extends BaseASTNode {
  kind: Kind.Enumerator;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  value: ASTNode;
}

/** AST node for `Enum` */
export interface EnumNode extends BaseASTNode {
  kind: Kind.Enum;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  values: ASTNode;
}

/** AST node for `ExprList` */
export interface ExprListNode extends BaseASTNode {
  /** List of child AST nodes */
  exprs: ASTNode[];
  kind: Kind.ExprList;
}

/** AST node for `FileAST` */
export interface FileASTNode extends BaseASTNode {
  /** List of child AST nodes */
  ext: ASTNode[];
  kind: Kind.FileAST;
}

/** AST node for `For` */
export interface ForNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  /** Child AST node */
  init: ASTNode;
  kind: Kind.For;
  /** Child AST node */
  next: ASTNode;
  /** Child AST node */
  stmt: ASTNode;
}

/** AST node for `FuncCall` */
export interface FuncCallNode extends BaseASTNode {
  /** Child AST node */
  args: ASTNode;
  kind: Kind.FuncCall;
  /** Child AST node */
  name: ASTNode;
}

/** AST node for `FuncDecl` */
export interface FuncDeclNode extends BaseASTNode {
  /** Child AST node */
  args: ASTNode;
  kind: Kind.FuncDecl;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `FuncDef` */
export interface FuncDefNode extends BaseASTNode {
  /** Child AST node */
  body: ASTNode;
  /** Child AST node */
  decl: ASTNode;
  kind: Kind.FuncDef;
  /** List of child AST nodes */
  param_decls: ASTNode[];
}

/** AST node for `Goto` */
export interface GotoNode extends BaseASTNode {
  kind: Kind.Goto;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `IdentifierType` */
export interface IdentifierTypeNode extends BaseASTNode {
  kind: Kind.IdentifierType;
  /** Literal or attribute */
  names?: boolean | null | number | string;
}

/** AST node for `ID` */
export interface IDNode extends BaseASTNode {
  kind: Kind.ID;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `If` */
export interface IfNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  /** Child AST node */
  iffalse: ASTNode;
  /** Child AST node */
  iftrue: ASTNode;
  kind: Kind.If;
}

/** AST node for `InitList` */
export interface InitListNode extends BaseASTNode {
  /** List of child AST nodes */
  exprs: ASTNode[];
  kind: Kind.InitList;
}

/** AST node for `Label` */
export interface LabelNode extends BaseASTNode {
  kind: Kind.Label;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Child AST node */
  stmt: ASTNode;
}

/** AST node for `NamedInitializer` */
export interface NamedInitializerNode extends BaseASTNode {
  /** Child AST node */
  expr: ASTNode;
  kind: Kind.NamedInitializer;
  /** List of child AST nodes */
  name: ASTNode[];
}

/** AST node for `ParamList` */
export interface ParamListNode extends BaseASTNode {
  kind: Kind.ParamList;
  /** List of child AST nodes */
  params: ASTNode[];
}

/** AST node for `Pragma` */
export interface PragmaNode extends BaseASTNode {
  kind: Kind.Pragma;
  /** Literal or attribute */
  string?: boolean | null | number | string;
}

/** AST node for `PtrDecl` */
export interface PtrDeclNode extends BaseASTNode {
  kind: Kind.PtrDecl;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `Return` */
export interface ReturnNode extends BaseASTNode {
  /** Child AST node */
  expr: ASTNode;
  kind: Kind.Return;
}

/** AST node for `StaticAssert` */
export interface StaticAssertNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  kind: Kind.StaticAssert;
  /** Child AST node */
  message: ASTNode;
}

/** AST node for `Struct` */
export interface StructNode extends BaseASTNode {
  /** List of child AST nodes */
  decls: ASTNode[];
  kind: Kind.Struct;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `StructRef` */
export interface StructRefNode extends BaseASTNode {
  /** Child AST node */
  field: ASTNode;
  kind: Kind.StructRef;
  /** Child AST node */
  name: ASTNode;
  /** Literal or attribute */
  type?: boolean | null | number | string;
}

/** AST node for `Switch` */
export interface SwitchNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  kind: Kind.Switch;
  /** Child AST node */
  stmt: ASTNode;
}

/** AST node for `TernaryOp` */
export interface TernaryOpNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  /** Child AST node */
  iffalse: ASTNode;
  /** Child AST node */
  iftrue: ASTNode;
  kind: Kind.TernaryOp;
}

/** AST node for `TypeDecl` */
export interface TypeDeclNode extends BaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  /** Literal or attribute */
  declname?: boolean | null | number | string;
  kind: Kind.TypeDecl;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `Typedef` */
export interface TypedefNode extends BaseASTNode {
  kind: Kind.Typedef;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Literal or attribute */
  storage?: boolean | null | number | string;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `Typename` */
export interface TypenameNode extends BaseASTNode {
  /** Literal or attribute */
  align?: boolean | null | number | string;
  kind: Kind.Typename;
  /** Literal or attribute */
  name?: boolean | null | number | string;
  /** Literal or attribute */
  quals?: boolean | null | number | string;
  /** Child AST node */
  type: ASTNode;
}

/** AST node for `UnaryOp` */
export interface UnaryOpNode extends BaseASTNode {
  /** Child AST node */
  expr: ASTNode;
  kind: Kind.UnaryOp;
  /** Literal or attribute */
  op?: boolean | null | number | string;
}

/** AST node for `Union` */
export interface UnionNode extends BaseASTNode {
  /** List of child AST nodes */
  decls: ASTNode[];
  kind: Kind.Union;
  /** Literal or attribute */
  name?: boolean | null | number | string;
}

/** AST node for `While` */
export interface WhileNode extends BaseASTNode {
  /** Child AST node */
  cond: ASTNode;
  kind: Kind.While;
  /** Child AST node */
  stmt: ASTNode;
}
