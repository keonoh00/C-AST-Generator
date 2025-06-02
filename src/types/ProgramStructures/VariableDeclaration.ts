import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IVariableDeclaration extends IBaseNode {
  name: string;
  nodeType: ASTNodeTypes.VariableDeclaration;
  type: string;
}
