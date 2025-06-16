// Contains the arrays of vertices and edges
export interface GraphData {
  edges: GraphEdge[];
  vertices: GraphVertex[];
}

// Represents an edge between vertices.
// JSON shape:
// {
//   "@type": string,
//   "id": { "@type": ..., "@value": ... },
//   "inV": { "@type": ..., "@value": ... },
//   "inVLabel": string,
//   "label": string,
//   "outV": { "@type": ..., "@value": ... },
//   "outVLabel": string,
//   "properties": { [propertyName: string]: GraphVertexProperty }
// }
export interface GraphEdge {
  "@type": string;
  id: RawValue;
  // ID of the target/inbound vertex
  inV: RawValue;
  inVLabel: string;
  // Label for this edge (e.g., "REF", etc.)
  label: string;
  // ID of the source/outbound vertex
  outV: RawValue;
  outVLabel: string;
  properties: Record<string, GraphVertexProperty>;
}

// Wrapper around the graph payload, as in the JSON:
// "export": { "@type": "...", "@value": { vertices: [...], edges: [...] } }
export interface GraphExportWrapper {
  "@type": string;
  "@value": GraphData;
}

// Represents a vertex in the graph.
// JSON shape:
// {
//   "@type": string,
//   "id": { "@type": ..., "@value": ... },
//   "label": string,
//   "properties": { [propertyName: string]: GraphVertexProperty }
// }
export interface GraphVertex {
  "@type": string;
  id: RawValue;
  label: string;
  properties: Record<string, GraphVertexProperty>;
}

// Represents a property attached to a vertex in the CPG/graph.
// The JSON shape is:
// {
//   "@type": string,
//   "@value": { "@type": "g:List", "@value": [...] },
//   "id": { "@type": ..., "@value": ... }
// }
export interface GraphVertexProperty {
  "@type": string;
  "@value": RawListValue;
  id: RawValue;
}

// Top-level interface for the Joern CPG export JSON:
// {
//   export: { "@type": "...", "@value": { vertices: [...], edges: [...] } }
// }
export interface JoernCPGRoot {
  export: GraphExportWrapper;
}

// Wrapper specifically for list-typed values: "@type": "g:List", "@value": [ ... ]
export interface RawListValue {
  "@type": string;
  "@value": (boolean | number | Record<string, unknown> | string)[];
}

// Wrapper for any raw typed value in the JSON (e.g., {"@type": "...", "@value": ...})
export interface RawValue {
  "@type": string;
  "@value": boolean | null | number | Record<string, unknown> | string | unknown[];
}
