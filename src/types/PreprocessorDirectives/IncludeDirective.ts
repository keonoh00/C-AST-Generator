import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IIncludeDirective extends IBaseNode {
  nodeType: ASTNodeTypes.IncludeDirective;
}
