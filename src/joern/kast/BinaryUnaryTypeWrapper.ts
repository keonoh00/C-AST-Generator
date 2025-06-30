import { CallVertexProperties, TreeNode } from "@/types/joern";

import { BinaryExpressionBooleanMap } from "./BinaryExpression";

export function BinaryUnaryTypeWrapper(node: TreeNode): string {
  if (BinaryExpressionBooleanMap[node.name]) {
    return BinaryExpressionBooleanMap[node.name];
  }

  const childrenTypes = node.children.map((child) => {
    const type = inferTypeBottomUp(child);
    return isAmbiguous(type) ? "int" : type;
  });

  const uniqueTypes = new Set(childrenTypes);

  if (uniqueTypes.size === 1) {
    return [...uniqueTypes][0];
  }

  return "<unknown>";
}
// Recursive inference from bottom-up
export function inferTypeBottomUp(node: TreeNode): string {
  const currentType = extractRawType(node);

  // If current node has a definite type, use it
  if (currentType && !isAmbiguous(currentType)) {
    return currentType;
  }

  // Recursively infer from children
  const childTypes = node.children.map(inferTypeBottomUp).filter(Boolean);

  if (childTypes.length === 0) return "unknown";

  // Heuristically merge types from children
  const uniqueTypes = Array.from(new Set(childTypes));

  // Prefer a consistent single type if available
  if (uniqueTypes.length === 1) {
    return uniqueTypes[0];
  }

  // Fallback: represent as a tuple or return union
  return `(${uniqueTypes.join(" ")})`;
}

// Extract raw type string from the deeply nested field
function extractRawType(node: TreeNode): string | undefined {
  const properties = node.properties as unknown as CallVertexProperties;
  return properties.TYPE_FULL_NAME["@value"]["@value"].join("/");
}

// Check if a type is ambiguous (e.g., 'ANY', '(ANY int)', etc.)
function isAmbiguous(type: string): boolean {
  return type.includes("ANY") || type === "unknown" || type === "void" || type.trim() === "";
}
