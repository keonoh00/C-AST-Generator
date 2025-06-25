// core.ts
export type EdgeLabel =
  | "ARGUMENT"
  | "AST"
  | "BINDS"
  | "CALL"
  | "CDG"
  | "CFG"
  | "CONDITION"
  | "CONTAINS"
  | "DOMINATE"
  | "EVAL_TYPE"
  | "IMPORTS"
  | "PARAMETER_LINK"
  | "POST_DOMINATE"
  | "REACHING_DEF"
  | "REF"
  | "SOURCE_FILE";

export interface GraphSON<T> {
  "@type": string;
  "@value": {
    "@type": string;
    "@value": T;
  };
}

export type GraphSONValue = boolean | GraphSONValue[] | null | number | string | { [key: string]: GraphSONValue };

export interface NodeInfo {
  code: string;
  id: string;
  label: VertexLabel;
  line_no: number | string;
  name: string;
  properties: VertexProperty<GraphSONValue>[];
}

export interface TreeNode extends NodeInfo {
  children: TreeNode[];
}

export type VertexLabel =
  | "BINDING"
  | "BLOCK"
  | "CALL"
  | "CONTROL_STRUCTURE"
  | "DEPENDENCY"
  | "FIELD_IDENTIFIER"
  | "FILE"
  | "IDENTIFIER"
  | "IMPORT"
  | "JUMP_TARGET"
  | "LITERAL"
  | "LOCAL"
  | "MEMBER"
  | "META_DATA"
  | "METHOD"
  | "METHOD_PARAMETER_IN"
  | "METHOD_PARAMETER_OUT"
  | "METHOD_REF"
  | "METHOD_RETURN"
  | "MODIFIER"
  | "NAMESPACE"
  | "NAMESPACE_BLOCK"
  | "RETURN"
  | "TYPE"
  | "TYPE_DECL"
  | "TYPE_REF"
  | "UNKNOWN";

export interface VertexProperty<T> {
  "@type": "g:VertexProperty";
  "@value": GraphSON<T>;
  id: GraphSON<number>;
}
