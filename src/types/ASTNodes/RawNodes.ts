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
  EllipsisParam = "EllipsisParam",
  EmptyStatement = "EmptyStatement",
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
  ParamList = "ParamList",
  PtrDecl = "PtrDecl",
  Return = "Return",
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

export interface IRawArrayDeclNode {
  _nodetype: RawASTNodeTypes.ArrayDecl;
  children?: {
    dim?: IRawBinaryOpNode | IRawConstantNode | IRawIDNode;
    type: IRawPtrDeclNode | IRawTypeDeclNode;
  };
}

export interface IRawArrayRefNode {
  _nodetype: RawASTNodeTypes.ArrayRef;
  children?: {
    name: IRawIDNode | IRawStructRefNode;
    subscript: IRawBinaryOpNode | IRawConstantNode | IRawIDNode;
  };
}

export interface IRawAssignmentNode {
  _nodetype: RawASTNodeTypes.Assignment;
  children?: {
    lvalue: IRawArrayRefNode | IRawIDNode | IRawStructRefNode | IRawUnaryOpNode;
    rvalue:
      | IRawArrayRefNode
      | IRawBinaryOpNode
      | IRawCastNode
      | IRawConstantNode
      | IRawFuncCallNode
      | IRawIDNode
      | IRawStructRefNode
      | IRawUnaryOpNode;
  };
  op: string;
}

export interface IRawBinaryOpNode {
  _nodetype: RawASTNodeTypes.BinaryOp;
  children?: {
    left: IRawArrayRefNode | IRawBinaryOpNode | IRawCastNode | IRawConstantNode | IRawFuncCallNode | IRawIDNode | IRawStructRefNode | IRawUnaryOpNode;
    right: IRawBinaryOpNode | IRawCastNode | IRawConstantNode | IRawFuncCallNode | IRawIDNode | IRawUnaryOpNode;
  };
  op: string;
}

export interface IRawBreakNode {
  _nodetype: RawASTNodeTypes.Break;
}

export interface IRawCaseNode {
  _nodetype: RawASTNodeTypes.Case;
  children?: {
    expr: IRawConstantNode;
    stmts: (
      | IRawAssignmentNode
      | IRawBreakNode
      | IRawCompoundNode
      | IRawConstantNode
      | IRawEmptyStatementNode
      | IRawForNode
      | IRawFuncCallNode
      | IRawIfNode
    )[];
  };
}

export interface IRawCastNode {
  _nodetype: RawASTNodeTypes.Cast;
  children?: {
    expr:
      | IRawBinaryOpNode
      | IRawCastNode
      | IRawConstantNode
      | IRawFuncCallNode
      | IRawIDNode
      | IRawStructRefNode
      | IRawTernaryOpNode
      | IRawUnaryOpNode;
    to_type: IRawTypenameNode;
  };
}

export interface IRawCompoundNode {
  _nodetype: RawASTNodeTypes.Compound;
  children?: {
    block_items?: (
      | IRawAssignmentNode
      | IRawBinaryOpNode
      | IRawBreakNode
      | IRawCaseNode
      | IRawCastNode
      | IRawCompoundNode
      | IRawConstantNode
      | IRawDeclNode
      | IRawDefaultNode
      | IRawDoWhileNode
      | IRawEmptyStatementNode
      | IRawForNode
      | IRawFuncCallNode
      | IRawGotoNode
      | IRawIfNode
      | IRawLabelNode
      | IRawReturnNode
      | IRawSwitchNode
      | IRawUnaryOpNode
      | IRawWhileNode
    )[];
  };
}

export interface IRawConstantNode {
  _nodetype: RawASTNodeTypes.Constant;
  type: string;
  value: string;
}

export interface IRawDeclNode {
  _nodetype: RawASTNodeTypes.Decl;
  children?: {
    init?:
      | IRawArrayRefNode
      | IRawBinaryOpNode
      | IRawCastNode
      | IRawConstantNode
      | IRawFuncCallNode
      | IRawIDNode
      | IRawInitListNode
      | IRawStructRefNode
      | IRawUnaryOpNode;
    type: IRawArrayDeclNode | IRawFuncDeclNode | IRawPtrDeclNode | IRawTypeDeclNode;
  };
  name: string;
  quals: string[];
  storage: string[];
}

export interface IRawDefaultNode {
  _nodetype: RawASTNodeTypes.Default;
  children?: {
    stmts: (IRawAssignmentNode | IRawBreakNode | IRawCompoundNode | IRawEmptyStatementNode | IRawFuncCallNode | IRawIfNode | IRawReturnNode)[];
  };
}

export interface IRawDoWhileNode {
  _nodetype: RawASTNodeTypes.DoWhile;
  children?: {
    cond: IRawBinaryOpNode | IRawConstantNode;
    stmt: IRawCompoundNode;
  };
}

export interface IRawEllipsisParamNode {
  _nodetype: RawASTNodeTypes.EllipsisParam;
}

export interface IRawEmptyStatementNode {
  _nodetype: RawASTNodeTypes.EmptyStatement;
}

export interface IRawExprListNode {
  _nodetype: RawASTNodeTypes.ExprList;
  children?: {
    exprs: (
      | IRawArrayRefNode
      | IRawBinaryOpNode
      | IRawCastNode
      | IRawConstantNode
      | IRawFuncCallNode
      | IRawIDNode
      | IRawStructRefNode
      | IRawUnaryOpNode
    )[];
  };
}

export interface IRawFileASTNode {
  _nodetype: RawASTNodeTypes.FileAST;
  children?: {
    ext?: (IRawDeclNode | IRawFuncDefNode | IRawTypedefNode)[];
  };
}

export interface IRawForNode {
  _nodetype: RawASTNodeTypes.For;
  children?: {
    cond?: IRawBinaryOpNode;
    init?: IRawAssignmentNode;
    next?: IRawAssignmentNode | IRawUnaryOpNode;
    stmt: IRawCompoundNode;
  };
}

export interface IRawFuncCallNode {
  _nodetype: RawASTNodeTypes.FuncCall;
  children?: {
    args?: IRawExprListNode;
    name: IRawIDNode;
  };
}

export interface IRawFuncDeclNode {
  _nodetype: RawASTNodeTypes.FuncDecl;
  children?: {
    args?: IRawParamListNode;
    type: IRawPtrDeclNode | IRawTypeDeclNode;
  };
}

export interface IRawFuncDefNode {
  _nodetype: RawASTNodeTypes.FuncDef;
  children?: {
    body: IRawCompoundNode;
    decl: IRawDeclNode;
  };
}

export interface IRawGotoNode {
  _nodetype: RawASTNodeTypes.Goto;
  name: string;
}

export interface IRawIdentifierTypeNode {
  _nodetype: RawASTNodeTypes.IdentifierType;
  names: string[];
}

export interface IRawIDNode {
  _nodetype: RawASTNodeTypes.ID;
  name: string;
}

export interface IRawIfNode {
  _nodetype: RawASTNodeTypes.If;
  children?: {
    cond: IRawAssignmentNode | IRawBinaryOpNode | IRawConstantNode | IRawFuncCallNode | IRawIDNode | IRawUnaryOpNode;
    iffalse?: IRawCompoundNode;
    iftrue: IRawCompoundNode | IRawEmptyStatementNode | IRawFuncCallNode;
  };
}

export interface IRawInitListNode {
  _nodetype: RawASTNodeTypes.InitList;
  children?: {
    exprs: (IRawConstantNode | IRawIDNode | IRawUnaryOpNode)[];
  };
}

export interface IRawLabelNode {
  _nodetype: RawASTNodeTypes.Label;
  children?: {
    stmt: IRawAssignmentNode | IRawCompoundNode | IRawConstantNode | IRawEmptyStatementNode | IRawForNode | IRawFuncCallNode | IRawIfNode;
  };
  name: string;
}

export interface IRawParamListNode {
  _nodetype: RawASTNodeTypes.ParamList;
  children?: {
    params: (IRawDeclNode | IRawEllipsisParamNode | IRawTypenameNode)[];
  };
}

export interface IRawPtrDeclNode {
  _nodetype: RawASTNodeTypes.PtrDecl;
  children?: {
    type: IRawFuncDeclNode | IRawPtrDeclNode | IRawTypeDeclNode;
  };
}

export interface IRawReturnNode {
  _nodetype: RawASTNodeTypes.Return;
  children?: {
    expr?: IRawConstantNode | IRawIDNode;
  };
}

export interface IRawStructNode {
  _nodetype: RawASTNodeTypes.Struct;
  children?: {
    decls?: IRawDeclNode[];
  };
  name: null | string;
}

export interface IRawStructRefNode {
  _nodetype: RawASTNodeTypes.StructRef;
  children?: {
    field: IRawIDNode;
    name: IRawArrayRefNode | IRawIDNode | IRawStructRefNode;
  };
  type: string;
}

export interface IRawSwitchNode {
  _nodetype: RawASTNodeTypes.Switch;
  children?: {
    cond: IRawConstantNode | IRawIDNode;
    stmt: IRawCompoundNode;
  };
}

export interface IRawTernaryOpNode {
  _nodetype: RawASTNodeTypes.TernaryOp;
  children?: {
    cond: IRawBinaryOpNode;
    iffalse: IRawBinaryOpNode;
    iftrue: IRawBinaryOpNode;
  };
}

export interface IRawTypeDeclNode {
  _nodetype: RawASTNodeTypes.TypeDecl;
  align: null;
  children?: {
    type: IRawIdentifierTypeNode | IRawStructNode | IRawUnionNode;
  };
  declname: null | string;
  quals: string[];
}

export interface IRawTypedefNode {
  _nodetype: RawASTNodeTypes.Typedef;
  children?: {
    type: IRawTypeDeclNode;
  };
  name: string;
  storage: string[];
}

export interface IRawTypenameNode {
  _nodetype: RawASTNodeTypes.Typename;
  align: null;
  children?: {
    type: IRawPtrDeclNode | IRawTypeDeclNode;
  };
  name: null;
}

export interface IRawUnaryOpNode {
  _nodetype: RawASTNodeTypes.UnaryOp;
  children?: {
    expr:
      | IRawArrayRefNode
      | IRawBinaryOpNode
      | IRawCastNode
      | IRawConstantNode
      | IRawFuncCallNode
      | IRawIDNode
      | IRawStructRefNode
      | IRawTypenameNode
      | IRawUnaryOpNode;
  };
  op: string;
}

export interface IRawUnionNode {
  _nodetype: RawASTNodeTypes.Union;
  children?: {
    decls: IRawDeclNode[];
  };
  name: null;
}

export interface IRawWhileNode {
  _nodetype: RawASTNodeTypes.While;
  children?: {
    cond: IRawBinaryOpNode | IRawConstantNode;
    stmt: IRawCompoundNode;
  };
}

export type RawASTNodes =
  | IRawArrayDeclNode
  | IRawArrayRefNode
  | IRawAssignmentNode
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
  | IRawFileASTNode
  | IRawForNode
  | IRawFuncCallNode
  | IRawFuncDeclNode
  | IRawFuncDefNode
  | IRawGotoNode
  | IRawIdentifierTypeNode
  | IRawIDNode
  | IRawIfNode
  | IRawInitListNode
  | IRawLabelNode
  | IRawParamListNode
  | IRawPtrDeclNode
  | IRawReturnNode
  | IRawStructNode
  | IRawStructRefNode
  | IRawSwitchNode
  | IRawTernaryOpNode
  | IRawTypeDeclNode
  | IRawTypedefNode
  | IRawTypenameNode
  | IRawUnaryOpNode
  | IRawUnionNode
  | IRawWhileNode;
