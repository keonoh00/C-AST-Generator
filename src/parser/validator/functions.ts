import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ASTNodes } from "@/types/node";

import { ASTGraph } from "../separator";

/** Compare two arrays of ASTGraphs and report drops */
export function validateGraphs(convertGraphs: ASTGraph[], filterGraphs: ASTGraph[], whitelist: ASTNodeTypes[], blacklist: ASTNodeTypes[]): void {
  const convertCounts = countNodeTypes(convertGraphs);
  const filterCounts = countNodeTypes(filterGraphs);

  const droppedTypes = whitelist.filter((t) => (filterCounts[t] || 0) < (convertCounts[t] || 0));
  if (droppedTypes.length) {
    console.warn("[validation] Dropped whitelisted types:", droppedTypes.join(", "));
  }

  const presentBlack = blacklist.filter((t) => (filterCounts[t] || 0) > 0);
  if (presentBlack.length) {
    console.warn("[validation] Blacklisted types present after filter:", presentBlack.join(", "));
  }

  // 3) Total nodes dropped
  const totalConvert = convertGraphs.reduce((sum, g) => sum + g.nodes.length, 0);
  const totalFilter = filterGraphs.reduce((sum, g) => sum + g.nodes.length, 0);
  const droppedCount = totalConvert - totalFilter;

  if (droppedCount > 0) {
    console.warn(`[validation] Total nodes dropped: ${droppedCount.toString()}`);
  } else {
    console.log("[validation] No nodes dropped");
  }
}

/**
 * Validate raw ASTNodes arrays (before separation) against whitelist/blacklist.
 */
export function validateNodeArrays(converted: ASTNodes[], filtered: ASTNodes[], whitelist: ASTNodeTypes[], blacklist: ASTNodeTypes[]): void {
  const convertedCounts = countNodeTypesInNodes(converted);
  const filteredCounts = countNodeTypesInNodes(filtered);

  const dropped = whitelist.filter((t) => (filteredCounts[t] || 0) < (convertedCounts[t] || 0));
  if (dropped.length) {
    console.warn("[validation] In ASTNodes: dropped whitelisted types:", dropped.join(", "));
  }

  // 2) Blacklisted types survived?
  const survivedBlack = blacklist.filter((t) => (filteredCounts[t] || 0) > 0);
  if (survivedBlack.length) {
    console.warn("[validation] In ASTNodes: blacklisted types present:", survivedBlack.join(", "));
  }

  // 3) Total nodes dropped
  // total nodes dropped (use the deep counts, not root count)
  const totalConverted = Object.values(convertedCounts).reduce((sum, v) => sum + v, 0);
  const totalFiltered = Object.values(filteredCounts).reduce((sum, v) => sum + v, 0);
  const droppedCount = totalConverted - totalFiltered;
  if (droppedCount > 0) {
    console.warn(`[validation] In ASTNodes: total nodes dropped: ${droppedCount.toString()}`);
  } else {
    console.log("[validation] In ASTNodes: no nodes dropped");
  }
}

/** Count nodeType occurrences across an array of ASTGraph */
function countNodeTypes(graphs: ASTGraph[]): Record<ASTNodeTypes, number> {
  const counts = {} as Record<ASTNodeTypes, number>;
  for (const g of graphs) {
    for (const n of g.nodes) {
      counts[n.nodeType] = (counts[n.nodeType] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Recursively count every .nodeType in each ASTNodes tree.
 */
function countNodeTypesInNodes(trees: ASTNodes[]): Record<ASTNodeTypes, number> {
  const counts = {} as Record<ASTNodeTypes, number>;
  const visit = (node: ASTNodes) => {
    counts[node.nodeType] = (counts[node.nodeType] || 0) + 1;
    if (Array.isArray(node.children)) {
      for (const c of node.children) visit(c);
    }
  };
  for (const root of trees) {
    visit(root);
  }
  return counts;
}
