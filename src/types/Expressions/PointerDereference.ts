import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IPointerDereference extends IBaseNode {
  nodeType: ASTNodeTypes.PointerDereference;
  rhs: string;
}
