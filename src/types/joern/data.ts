// data.ts
import { EdgeGeneric } from "./edge";
import { VertexGeneric } from "./vertex";

export interface GraphData {
  edges: EdgeGeneric[];
  vertices: VertexGeneric[];
}

export interface RootGraphSON {
  "@type": string;
  "@value": GraphData;
}
