import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IArraySubscriptionExpression extends IBaseNode {
  nodeType: ASTNodeTypes.ArraySubscriptionExpression;
}
