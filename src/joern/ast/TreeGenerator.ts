import { GraphData, GraphVertex } from "@/types/Joern";

interface TreeNode extends GraphVertex {
  children: TreeNode[];
}

export class TreeGenerator {
  public generateForest(graph: GraphData): TreeNode[] {
    const idMap = this.buildIdMap(graph.vertices);
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, string[]>();

    for (const edge of graph.edges) {
      const out = edge.outV["@value"];
      const inn = edge.inV["@value"];

      if ((typeof out !== "string" && typeof out !== "number") || (typeof inn !== "string" && typeof inn !== "number")) {
        continue;
      }

      const parentId = String(out);
      const childId = String(inn);

      childToParent.set(childId, parentId);

      const existingChildren = parentToChildren.get(parentId);
      if (existingChildren !== undefined) {
        existingChildren.push(childId);
      } else {
        parentToChildren.set(parentId, [childId]);
      }
    }

    const rootIds: string[] = [];
    for (const v of graph.vertices) {
      const rawId = v.id["@value"];
      if ((typeof rawId === "string" || typeof rawId === "number") && !childToParent.has(String(rawId))) {
        rootIds.push(String(rawId));
      }
    }

    const forest: TreeNode[] = [];
    for (const rootId of rootIds) {
      const root = this.buildSubtree(rootId, idMap, parentToChildren);
      if (root !== undefined) {
        forest.push(root);
      }
    }

    return forest;
  }

  private buildIdMap(vertices: GraphVertex[]): Record<string, GraphVertex> {
    const map: Record<string, GraphVertex> = {};
    for (const v of vertices) {
      const rawId = v.id["@value"];
      if (typeof rawId === "string" || typeof rawId === "number") {
        map[String(rawId)] = v;
      }
    }
    return map;
  }

  private buildSubtree(nodeId: string, idMap: Record<string, GraphVertex>, parentToChildren: Map<string, string[]>): TreeNode | undefined {
    const base = idMap[nodeId];

    const rawChildren = parentToChildren.get(nodeId) ?? [];
    const children: TreeNode[] = [];

    for (const childId of rawChildren) {
      const child = this.buildSubtree(childId, idMap, parentToChildren);
      if (child !== undefined) {
        children.push(child);
      }
    }

    return {
      ...base,
      children,
    };
  }
}
