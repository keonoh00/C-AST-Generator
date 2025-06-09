// src/parser/converter/helpers.ts
import { ASTNodeTypes } from "@/types/BaseNode/BaseNode";
import { ASTNodes } from "@/types/node";
import { IParserTypeDeclNode, KindToNodeMap, ParserNode, ParserNodeKind } from "@/types/pycparser";

/** Build a minimal “base” object { nodeType, ...extras } */
export function createNodeBase<T extends ASTNodeTypes, U extends object = Record<string, unknown>>(nodeType: T, extras?: U): U & { nodeType: T } {
  return { nodeType, ...(extras ?? ({} as U)) };
}

/** Recursively find the first descendant whose .kind === kind */
export function findParserNodeWithType<K extends ParserNodeKind>(node: ParserNode, kind: K): KindToNodeMap[K] | undefined {
  if (node.kind === kind) {
    return node as KindToNodeMap[K];
  }
  if (!Array.isArray(node.children)) {
    return undefined;
  }
  for (const c of node.children) {
    const found = findParserNodeWithType(c, kind);
    if (found) return found;
  }
  return undefined;
}

export function findTypeFromTypeDecl(typeDeclNode: IParserTypeDeclNode | undefined): string {
  const typeDeclAttrType = typeDeclNode?.type ? findParserNodeWithType(typeDeclNode.type, ParserNodeKind.IdentifierType) : undefined;

  const typeDeclIdentifier = typeDeclNode ? findParserNodeWithType(typeDeclNode, ParserNodeKind.IdentifierType) : undefined;

  return typeDeclAttrType?.names.join(" ") ?? typeDeclIdentifier?.names.join(" ") ?? "undefined";
}

/**
 * Given a “base” object { nodeType }, convert all of its children via
 * convertCParserNodes(...) and attach them under .children if nonempty.
 */
export function wrapChildren<T extends { nodeType: ASTNodeTypes }>(
  base: T,
  parserNode: ParserNode,
  convertFn: (nodes: ParserNode[]) => ASTNodes[]
): T & { children?: ASTNodes[] } {
  const rawKids = Array.isArray(parserNode.children) ? parserNode.children : [];
  const convertedKids = convertFn(rawKids);
  if (convertedKids.length > 0) {
    (base as T & { children?: ASTNodes[] }).children = convertedKids;
  }
  return base as T & { children?: ASTNodes[] };
}
