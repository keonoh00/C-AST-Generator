export interface ArrayDeclNode extends BaseNode {
  _nodetype: "ArrayDecl";
  children: {
    dim: ConstantNode[];
    type: TypeDeclNode[];
  };
  dim_quals: unknown[];
}

export interface ArrayRefNode extends BaseNode {
  _nodetype: "ArrayRef";
  children: { name: ASTNode[]; subscript: ASTNode[] };
}

export interface AssignmentNode extends BaseNode {
  _nodetype: "Assignment";
  children: { lvalue: ASTNode[]; rvalue: ASTNode[] };
  op: string;
}

// Combined union
export type ASTNode =
  | ArrayDeclNode
  | ArrayRefNode
  | AssignmentNode
  | BaseNode // fallback for any other nodetypes
  | BinaryOpNode
  | BreakNode
  | CaseNode
  | CastNode
  | CompoundNode
  | ConstantNode
  | DeclNode
  | DefaultNode
  | DoWhileNode
  | ExprListNode
  | FileAST
  | ForNode
  | FuncCallNode
  | FuncDeclNode
  | FuncDefNode
  | GotoNode
  | IdentifierTypeNode
  | IDNode
  | IfNode
  | LabelNode
  | PtrDeclNode
  | ReturnNode
  | StructNode
  | StructRefNode
  | SwitchNode
  | TernaryOpNode
  | TypeDeclNode
  | TypedefNode
  | UnaryOpNode
  | UnionNode
  | WhileNode;

export interface BaseNode {
  _nodetype: string;
  children?: Record<string, ASTNode[]>;
}

export interface BinaryOpNode extends BaseNode {
  _nodetype: "BinaryOp";
  children: { left: ASTNode[]; right: ASTNode[] };
  op: string;
}

export interface BreakNode extends BaseNode {
  _nodetype: "Break";
}

export interface CaseNode extends BaseNode {
  _nodetype: "Case";
  children: { expr: ConstantNode[]; stmts: ASTNode[] };
}

export interface CastNode extends BaseNode {
  _nodetype: "Cast";
  children: { expr: ASTNode[]; to_type: ASTNode[] };
}

// Statements & expressions
export interface CompoundNode extends BaseNode {
  _nodetype: "Compound";
  children: { block_items: ASTNode[] };
}

export interface ConstantNode extends BaseNode {
  _nodetype: "Constant";
  type: string;
  value: string;
}

export interface DeclNode extends BaseNode {
  _nodetype: "Decl";
  align: unknown[];
  children: { type: ASTNode[] };
  funcspec: unknown[];
  name: string;
  quals: unknown[];
  storage: unknown[];
}

export interface DefaultNode extends BaseNode {
  _nodetype: "Default";
  children: { stmts: ASTNode[] };
}

export interface DoWhileNode extends BaseNode {
  _nodetype: "DoWhile";
  children: { cond: ASTNode[]; stmt: ASTNode[] };
}

export interface ExprListNode extends BaseNode {
  _nodetype: "ExprList";
  children: { exprs: ASTNode[] };
}

export interface FileAST extends BaseNode {
  _nodetype: "FileAST";
  children: { ext: ASTNode[] };
}

export interface ForNode extends BaseNode {
  _nodetype: "For";
  children: { cond?: ASTNode[]; init?: ASTNode[]; next?: ASTNode[]; stmt: ASTNode[] };
}

export interface FuncCallNode extends BaseNode {
  _nodetype: "FuncCall";
  children: { args: ExprListNode[]; name: ASTNode[] };
}

// Function definitions
export interface FuncDeclNode extends BaseNode {
  _nodetype: "FuncDecl";
  children: { args?: ASTNode[]; type: ASTNode[] };
}

export interface FuncDefNode extends BaseNode {
  _nodetype: "FuncDef";
  children: { body: CompoundNode[]; decl: DeclNode[] };
}

export interface GotoNode extends BaseNode {
  _nodetype: "Goto";
  children: { name: IDNode[] };
}

// Type and declaration nodes
export interface IdentifierTypeNode extends BaseNode {
  _nodetype: "IdentifierType";
  names: string[];
}

// Leaf nodes
export interface IDNode extends BaseNode {
  _nodetype: "ID";
  name: string;
}

export interface IfNode extends BaseNode {
  _nodetype: "If";
  children: { cond: ASTNode[]; iffalse?: ASTNode[]; iftrue: ASTNode[] };
}

export interface LabelNode extends BaseNode {
  _nodetype: "Label";
  children: { name: IDNode[]; stmt: ASTNode[] };
}

export interface PtrDeclNode extends BaseNode {
  _nodetype: "PtrDecl";
  children: { type: TypeDeclNode[] };
  quals: unknown[];
}

export interface ReturnNode extends BaseNode {
  _nodetype: "Return";
  children: { expr: ASTNode[] };
}

export interface StructNode extends BaseNode {
  _nodetype: "Struct";
  children: { decls: DeclNode[] };
  name: string;
}

export interface StructRefNode extends BaseNode {
  _nodetype: "StructRef";
  children: { field: ASTNode[]; name: ASTNode[] };
  type: "->" | ".";
}

export interface SwitchNode extends BaseNode {
  _nodetype: "Switch";
  children: { cond: ASTNode[]; stmt: ASTNode[] };
}

export interface TernaryOpNode extends BaseNode {
  _nodetype: "TernaryOp";
  children: { cond: ASTNode[]; iffalse: ASTNode[]; iftrue: ASTNode[] };
}

export interface TypeDeclNode extends BaseNode {
  _nodetype: "TypeDecl";
  align: null;
  children: { type: ASTNode[] };
  declname: null | string;
  quals: unknown[];
}

export interface TypedefNode extends BaseNode {
  _nodetype: "Typedef";
  children: { type: TypeDeclNode[] };
  name: string;
  quals: unknown[];
  storage: string[];
}

export interface UnaryOpNode extends BaseNode {
  _nodetype: "UnaryOp";
  children: { expr: ASTNode[] };
  op: string;
}

export interface UnionNode extends BaseNode {
  _nodetype: "Union";
  children: { decls: DeclNode[] };
  name: string;
}

export interface WhileNode extends BaseNode {
  _nodetype: "While";
  children: { cond: ASTNode[]; stmt: ASTNode[] };
}
