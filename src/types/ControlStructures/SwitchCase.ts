import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface ISwitchCase extends IBaseNode {
  nodeType: ASTNodeTypes.SwitchCase;
}
