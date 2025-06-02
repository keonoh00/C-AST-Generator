import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface IArrayDeclaration extends IBaseNode {
  elementType: string;
  length: number;
  name: string;
  nodeType: ASTNodeTypes.ArrayDeclaration;
}
