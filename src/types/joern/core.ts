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
  "@value": T;
}

export type GraphSONValue = boolean | GraphSONValue[] | null | number | string | { [key: string]: GraphSONValue };

export type VertexLabel =
  | "BINDING"
  | "BLOCK"
  | "CALL"
  | "CONTROL_STRUCTURE"
  | "DEPENDENCY"
  | "FILE"
  | "IDENTIFIER"
  | "IMPORT"
  | "LITERAL"
  | "LOCAL"
  | "META_DATA"
  | "METHOD"
  | "METHOD_PARAMETER_IN"
  | "METHOD_PARAMETER_OUT"
  | "METHOD_REF"
  | "METHOD_RETURN"
  | "MODIFIER"
  | "NAMESPACE"
  | "NAMESPACE_BLOCK"
  | "TYPE"
  | "TYPE_DECL";

export interface VertexProperty<T> {
  "@type": "g:VertexProperty";
  "@value": GraphSON<T>;
  id: GraphSON<number>;
}
