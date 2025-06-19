import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IArraySizeAllocation extends IBaseNode {
  length: number;
  nodeType: ASTNodeTypes.ArraySizeAllocation;
}
