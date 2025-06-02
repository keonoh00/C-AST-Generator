export interface IRawArrayDeclNode extends IRawBaseNode {
  _nodetype: "ArrayDecl";
  children: {
    dim: IRawConstantNode[];
    type: IRawTypeDeclNode[];
  };
  dim_quals: unknown[];
}

export interface IRawArrayRefNode extends IRawBaseNode {
  _nodetype: "ArrayRef";
  children: { name: RawASTNodes[]; subscript: RawASTNodes[] };
}

export interface IRawAssignmentNode extends IRawBaseNode {
  _nodetype: "Assignment";
  children: { lvalue: RawASTNodes[]; rvalue: RawASTNodes[] };
  op: string;
}

export interface IRawBaseNode {
  _nodetype: string;
  children?: Record<string, RawASTNodes[]>;
}

export interface IRawBinaryOpNode extends IRawBaseNode {
  _nodetype: "BinaryOp";
  children: { left: RawASTNodes[]; right: RawASTNodes[] };
  op: string;
}

export interface IRawBreakNode extends IRawBaseNode {
  _nodetype: "Break";
}

export interface IRawCaseNode extends IRawBaseNode {
  _nodetype: "Case";
  children: { expr: IRawConstantNode[]; stmts: RawASTNodes[] };
}

export interface IRawCastNode extends IRawBaseNode {
  _nodetype: "Cast";
  children: { expr: RawASTNodes[]; to_type: RawASTNodes[] };
}

// Statements & expressions
export interface IRawCompoundNode extends IRawBaseNode {
  _nodetype: "Compound";
  children: { block_items: RawASTNodes[] };
}

export interface IRawConstantNode extends IRawBaseNode {
  _nodetype: "Constant";
  type: string;
  value: string;
}

export interface IRawDeclNode extends IRawBaseNode {
  _nodetype: "Decl";
  align: unknown[];
  children: { type: RawASTNodes[] };
  funcspec: unknown[];
  name: string;
  quals: unknown[];
  storage: unknown[];
}

export interface IRawDefaultNode extends IRawBaseNode {
  _nodetype: "Default";
  children: { stmts: RawASTNodes[] };
}

export interface IRawDoWhileNode extends IRawBaseNode {
  _nodetype: "DoWhile";
  children: { cond: RawASTNodes[]; stmt: RawASTNodes[] };
}

export interface IRawExprListNode extends IRawBaseNode {
  _nodetype: "ExprList";
  children: { exprs: RawASTNodes[] };
}

export interface IRawFileAST extends IRawBaseNode {
  _nodetype: "FileAST";
  children: { ext: RawASTNodes[] };
}

export interface IRawForNode extends IRawBaseNode {
  _nodetype: "For";
  children: { cond?: RawASTNodes[]; init?: RawASTNodes[]; next?: RawASTNodes[]; stmt: RawASTNodes[] };
}

export interface IRawFuncCallNode extends IRawBaseNode {
  _nodetype: "FuncCall";
  children: { args: IRawExprListNode[]; name: RawASTNodes[] };
}

// Function definitions
export interface IRawFuncDeclNode extends IRawBaseNode {
  _nodetype: "FuncDecl";
  children: { args?: RawASTNodes[]; type: RawASTNodes[] };
}

export interface IRawFuncDefNode extends IRawBaseNode {
  _nodetype: "FuncDef";
  children: { body: IRawCompoundNode[]; decl: IRawDeclNode[] };
}

export interface IRawGotoNode extends IRawBaseNode {
  _nodetype: "Goto";
  children: { name: IRawIDNode[] };
}

// Type and declaration nodes
export interface IRawIdentifierTypeNode extends IRawBaseNode {
  _nodetype: "IdentifierType";
  names: string[];
}

// Leaf nodes
export interface IRawIDNode extends IRawBaseNode {
  _nodetype: "ID";
  name: string;
}

export interface IRawIfNode extends IRawBaseNode {
  _nodetype: "If";
  children: { cond: RawASTNodes[]; iffalse?: RawASTNodes[]; iftrue: RawASTNodes[] };
}

export interface IRawLabelNode extends IRawBaseNode {
  _nodetype: "Label";
  children: { name: IRawIDNode[]; stmt: RawASTNodes[] };
}

export interface IRawPtrDeclNode extends IRawBaseNode {
  _nodetype: "PtrDecl";
  children: { type: IRawTypeDeclNode[] };
  quals: unknown[];
}

export interface IRawReturnNode extends IRawBaseNode {
  _nodetype: "Return";
  children: { expr: RawASTNodes[] };
}

export interface IRawStructNode extends IRawBaseNode {
  _nodetype: "Struct";
  children: { decls: IRawDeclNode[] };
  name: string;
}

export interface IRawStructRefNode extends IRawBaseNode {
  _nodetype: "StructRef";
  children: { field: RawASTNodes[]; name: RawASTNodes[] };
  type: "->" | ".";
}

export interface IRawSwitchNode extends IRawBaseNode {
  _nodetype: "Switch";
  children: { cond: RawASTNodes[]; stmt: RawASTNodes[] };
}

export interface IRawTernaryOpNode extends IRawBaseNode {
  _nodetype: "TernaryOp";
  children: { cond: RawASTNodes[]; iffalse: RawASTNodes[]; iftrue: RawASTNodes[] };
}

export interface IRawTypeDeclNode extends IRawBaseNode {
  _nodetype: "TypeDecl";
  align: null;
  children: { type: RawASTNodes[] };
  declname: null | string;
  quals: unknown[];
}

export interface IRawTypedefNode extends IRawBaseNode {
  _nodetype: "Typedef";
  children: { type: IRawTypeDeclNode[] };
  name: string;
  quals: unknown[];
  storage: string[];
}

export interface IRawUnaryOpNode extends IRawBaseNode {
  _nodetype: "UnaryOp";
  children: { expr: RawASTNodes[] };
  op: string;
}

export interface IRawUnionNode extends IRawBaseNode {
  _nodetype: "Union";
  children: { decls: IRawDeclNode[] };
  name: string;
}

export interface IRawWhileNode extends IRawBaseNode {
  _nodetype: "While";
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
