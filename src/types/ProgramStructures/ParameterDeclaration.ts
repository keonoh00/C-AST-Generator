import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IParameterDeclaration extends IBaseNode {
  name: string;
  nodeType: ASTNodeTypes.ParameterDeclaration;
  type: string;
}
