import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IUnarayExpression extends IBaseNode {
  nodeType: ASTNodeTypes.UnarayExpression;
  operator: string;
  type: string;
}
