// edge.ts
import { GraphSON } from "./core";
import { VertexLabel } from "./core";

export interface EdgeByLabelMap {
  ARGUMENT: object;
  AST: object;
  BINDS: object;
  CALL: object;
  CDG: object;
  CFG: object;
  CONDITION: object;
  CONTAINS: object;
  DOMINATE: object;
  EVAL_TYPE: object;
  IMPORTS: object;
  PARAMETER_LINK: object;
  POST_DOMINATE: object;
  REACHING_DEF: ReachingDefEdgeProperties;
  REF: object;
  SOURCE_FILE: object;
}

export interface EdgeGeneric<L extends import("./core").EdgeLabel = import("./core").EdgeLabel> {
  "@type": string;
  id: GraphSON<number>;
  inV: GraphSON<number>;
  inVLabel: VertexLabel;
  label: L;
  outV: GraphSON<number>;
  outVLabel: VertexLabel;
  properties: EdgeByLabelMap[L];
}

export interface ReachingDefEdgeProperties {
  EdgeProperty: GraphSON<string>;
}
