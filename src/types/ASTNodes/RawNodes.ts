export enum RawASTNodeTypes {
  ArrayDecl = "ArrayDecl",
  ArrayRef = "ArrayRef",
  Assignment = "Assignment",
  BinaryOp = "BinaryOp",
  Break = "Break",
  Case = "Case",
  Cast = "Cast",
  Compound = "Compound",
  Constant = "Constant",
  Decl = "Decl",
  Default = "Default",
  DoWhile = "DoWhile",
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
  Label = "Label",
  PtrDecl = "PtrDecl",
  Return = "Return",
  Struct = "Struct",
  StructRef = "StructRef",
  Switch = "Switch",
  TernaryOp = "TernaryOp",
  TypeDecl = "TypeDecl",
  Typedef = "Typedef",
  UnaryOp = "UnaryOp",
  Union = "Union",
  While = "While",
}
export interface IRawArrayDeclNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.ArrayDecl;
  children: {
    dim: IRawConstantNode[];
    type: IRawTypeDeclNode[];
  };
  dim_quals: unknown[];
}

export interface IRawArrayRefNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.ArrayRef;
  children: { name: RawASTNodes[]; subscript: RawASTNodes[] };
}

export interface IRawAssignmentNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Assignment;
  children: { lvalue: RawASTNodes[]; rvalue: RawASTNodes[] };
  op: string;
}

export interface IRawBaseNode {
  _nodetype: RawASTNodeTypes;
  children?: Record<string, RawASTNodes[]>;
}

export interface IRawBinaryOpNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.BinaryOp;
  children: { left: RawASTNodes[]; right: RawASTNodes[] };
  op: string;
}

export interface IRawBreakNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Break;
}

export interface IRawCaseNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Case;
  children: { expr: IRawConstantNode[]; stmts: RawASTNodes[] };
}

export interface IRawCastNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Cast;
  children: { expr: RawASTNodes[]; to_type: RawASTNodes[] };
}

// Statements & expressions
export interface IRawCompoundNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Compound;
  children: { block_items: RawASTNodes[] };
}

export interface IRawConstantNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Constant;
  type: string;
  value: string;
}

export interface IRawDeclNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Decl;
  align: unknown[];
  children: { type: RawASTNodes[] };
  funcspec: unknown[];
  name: string;
  quals: unknown[];
  storage: unknown[];
}

export interface IRawDefaultNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Default;
  children: { stmts: RawASTNodes[] };
}

export interface IRawDoWhileNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.DoWhile;
  children: { cond: RawASTNodes[]; stmt: RawASTNodes[] };
}

export interface IRawExprListNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.ExprList;
  children: { exprs: RawASTNodes[] };
}

export interface IRawFileAST extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.FileAST;
  children: { ext: RawASTNodes[] };
}

export interface IRawForNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.For;
  children: { cond?: RawASTNodes[]; init?: RawASTNodes[]; next?: RawASTNodes[]; stmt: RawASTNodes[] };
}

export interface IRawFuncCallNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.FuncCall;
  children: { args: IRawExprListNode[]; name: RawASTNodes[] };
}

// Function definitions
export interface IRawFuncDeclNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.FuncDecl;
  children: { args?: RawASTNodes[]; type: RawASTNodes[] };
}

export interface IRawFuncDefNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.FuncDef;
  children: { body: IRawCompoundNode[]; decl: IRawDeclNode[] };
}

export interface IRawGotoNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Goto;
  children: { name: IRawIDNode[] };
}

// Type and declaration nodes
export interface IRawIdentifierTypeNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.IdentifierType;
  names: string[];
}

// Leaf nodes
export interface IRawIDNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.ID;
  name: string;
}

export interface IRawIfNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.If;
  children: { cond: RawASTNodes[]; iffalse?: RawASTNodes[]; iftrue: RawASTNodes[] };
}

export interface IRawLabelNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Label;
  children: { name: IRawIDNode[]; stmt: RawASTNodes[] };
}

export interface IRawPtrDeclNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.PtrDecl;
  children: { type: IRawTypeDeclNode[] };
  quals: unknown[];
}

export interface IRawReturnNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Return;
  children: { expr: RawASTNodes[] };
}

export interface IRawStructNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Struct;
  children: { decls: IRawDeclNode[] };
  name: string;
}

export interface IRawStructRefNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.StructRef;
  children: { field: RawASTNodes[]; name: RawASTNodes[] };
  type: "->" | ".";
}

export interface IRawSwitchNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Switch;
  children: { cond: RawASTNodes[]; stmt: RawASTNodes[] };
}

export interface IRawTernaryOpNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.TernaryOp;
  children: { cond: RawASTNodes[]; iffalse: RawASTNodes[]; iftrue: RawASTNodes[] };
}

export interface IRawTypeDeclNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.TypeDecl;
  align: null;
  children: { type: RawASTNodes[] };
  declname: null | string;
  quals: unknown[];
}

export interface IRawTypedefNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Typedef;
  children: { type: IRawTypeDeclNode[] };
  name: string;
  quals: unknown[];
  storage: string[];
}

export interface IRawUnaryOpNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.UnaryOp;
  children: { expr: RawASTNodes[] };
  op: string;
}

export interface IRawUnionNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.Union;
  children: { decls: IRawDeclNode[] };
  name: string;
}

export interface IRawWhileNode extends IRawBaseNode {
  _nodetype: RawASTNodeTypes.While;
  children: { cond: RawASTNodes[]; stmt: RawASTNodes[] };
}

// Combined union
export type RawASTNodes =
  | IRawArrayDeclNode
  | IRawArrayRefNode
  | IRawAssignmentNode
  | IRawBaseNode // fallback for any other nodetypes
  | IRawBinaryOpNode
  | IRawBreakNode
  | IRawCaseNode
  | IRawCastNode
  | IRawCompoundNode
  | IRawConstantNode
  | IRawDeclNode
  | IRawDefaultNode
  | IRawDoWhileNode
  | IRawExprListNode
  | IRawFileAST
  | IRawForNode
  | IRawFuncCallNode
  | IRawFuncDeclNode
  | IRawFuncDefNode
  | IRawGotoNode
  | IRawIdentifierTypeNode
  | IRawIDNode
  | IRawIfNode
  | IRawLabelNode
  | IRawPtrDeclNode
  | IRawReturnNode
  | IRawStructNode
  | IRawStructRefNode
  | IRawSwitchNode
  | IRawTernaryOpNode
  | IRawTypeDeclNode
  | IRawTypedefNode
  | IRawUnaryOpNode
  | IRawUnionNode
  | IRawWhileNode;
