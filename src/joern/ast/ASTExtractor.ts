import { GraphData, JoernCPGRoot } from "@/types/Joern";

export class ASTExtractor {
  public extractAstEdges(rootParsed: unknown): GraphData {
    const graphData = this.getGraphData(rootParsed);
    const edges = graphData.edges.filter((edge) => edge.label === "AST");
    return { edges, vertices: graphData.vertices };
  }

  private getGraphData(input: unknown): GraphData {
    if (typeof input === "object" && input !== null) {
      if ("export" in input) {
        const exp = (input as JoernCPGRoot).export;
        if (typeof exp === "object" && "@value" in exp && this.isValidGraphData(exp["@value"])) {
          return exp["@value"];
        }
      }

      if ("@value" in input && this.isValidGraphData((input as { "@value": unknown })["@value"])) {
        return (input as { "@value": GraphData })["@value"];
      }
    }

    throw new Error("Invalid CPG format");
  }

  private isValidGraphData(value: unknown): value is GraphData {
    if (typeof value === "object" && value !== null && "edges" in value && "vertices" in value) {
      const g = value as GraphData;
      return Array.isArray(g.edges) && Array.isArray(g.vertices);
    }
    return false;
  }
}
