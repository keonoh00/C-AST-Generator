import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface ReturnStatement extends IBaseNode {
  nodeType: ASTNodeTypes.ReturnStatement;
}
