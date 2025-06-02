import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IAssignmentExpression extends IBaseNode {
  name: string;
  nodeType: ASTNodeTypes.AssignmentExpression;
}
