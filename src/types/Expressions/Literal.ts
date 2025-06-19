import { ASTNodeTypes, IBaseNode } from "../BaseNode/BaseNode";

export interface ILiteral extends IBaseNode {
  nodeType: ASTNodeTypes.Literal;
  type: string;
  value: boolean | null | number | string;
}
