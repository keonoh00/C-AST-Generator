import type { EdgeGeneric, NodeInfo } from "@/types/cpg";

import { ASTNodeTypes } from "@/types/ast/BaseNode/BaseNode";
import { FlowType, GuardType, type IDFGEdge, type IDFGGraph, type IDFGNode } from "@/types/dfg";

export class DFGBuilder {
  public build(dfg: { edges: EdgeGeneric[]; vertices: NodeInfo[] }): IDFGGraph {
    // Index vertices and compute degrees for features
    const outDeg = new Map<number, number>();
    const inDeg = new Map<number, number>();
    const outDef = new Map<number, number>();
    const inUse = new Map<number, number>();
    for (const e of dfg.edges) {
      const s = e.outV["@value"];
      const t = e.inV["@value"];
      outDeg.set(s, (outDeg.get(s) ?? 0) + 1);
      inDeg.set(t, (inDeg.get(t) ?? 0) + 1);

      if (e.label === "REACHING_DEF") {
        outDef.set(s, (outDef.get(s) ?? 0) + 1);
        inUse.set(t, (inUse.get(t) ?? 0) + 1);
      }
    }

    // Build nodes (include any vertex that appears in vertices list)
    const nodes: IDFGNode[] = dfg.vertices.map((v) => {
      const idNum = Number(v.id);
      const code = v.code;
      const codeL = code.toLowerCase();
      const isCall = v.label === "CALL";
      const isIdentifier = v.label === "IDENTIFIER";
      const isLiteral = v.label === "LITERAL";
      const isMember = v.label === "MEMBER" || v.label === "FIELD_IDENTIFIER";
      const nodeType = this.mapVertexToAstType(v.label, isCall, isIdentifier, isLiteral, isMember);
      const inDegreeDFG = inDeg.get(idNum) ?? 0;
      const outDegreeDFG = outDeg.get(idNum) ?? 0;
      const defCount = outDef.get(idNum) ?? 0;
      const useCount = inUse.get(idNum) ?? 0;

      // Heuristics for buffer access and call metadata
      const isBufferAccess = this.hasIndexing(code) || this.hasAnyExactCall(codeL, ["memcpy", "memmove", "strcpy", "strcat"]);
      const callDestinationIndexed = isCall && this.hasIndexing(code);
      const callLengthLinkedToDestination = isCall && this.hasAnyExactCall(codeL, ["sizeof", "strlen"]);
      const callSizeNonConstant = isCall && !this.hasAnyExactCall(codeL, ["sizeof", "strlen"]) && this.hasParenCall(code);
      const callDangerUnbounded = isCall && this.hasAnyExactCall(codeL, ["gets", "strcpy", "strcat"]);

      return {
        id: Number.isNaN(idNum) ? -1 : idNum,
        features: {
          nodeType,
          inDegreeDFG,
          outDegreeDFG,
          defCount,
          useCount,
          isBufferAccess,
          isSinkAssignment: isIdentifier && this.hasAssignment(code),
          isSinkCallUnbounded: callDangerUnbounded,
          isSinkCallBounded: isCall && this.hasAnyExactCall(codeL, ["memcpy", "memmove"]),
          callDestinationIndexed,
          callLengthLinkedToDestination,
          callSizeNonConstant,
          callDangerUnbounded,
        },
      };
    });

    // Build edges
    const edges: IDFGEdge[] = dfg.edges.map((e) => {
      const label = e.label;
      const flow: FlowType = label === "REACHING_DEF" ? FlowType.VALUE : FlowType.VALUE;
      // If edge is CDG, it is under a control guard. We mark IF by default.
      const isCdg = label === "CDG";
      const guard = isCdg ? GuardType.IF : GuardType.NONE;
      return {
        source: e.outV["@value"],
        destination: e.inV["@value"],
        features: {
          flow,
          guard,
          hasLowerGuard: false,
          hasUpperGuard: false,
          upperGuardNormalization: 0,
        },
      };
    });

    return { nodes, edges };
  }

  private mapVertexToAstType(label: NodeInfo["label"], isCall: boolean, isIdentifier: boolean, isLiteral: boolean, isMember: boolean): ASTNodeTypes {
    if (isCall) return ASTNodeTypes.UserDefinedCall;
    if (isIdentifier) return ASTNodeTypes.Identifier;
    if (isLiteral) return ASTNodeTypes.Literal;
    if (isMember) return ASTNodeTypes.MemberAccess;
    switch (label) {
      case "BLOCK":
        return ASTNodeTypes.CompoundStatement;
      case "CONTROL_STRUCTURE":
        return ASTNodeTypes.IfStatement;
      case "RETURN":
        return ASTNodeTypes.ReturnStatement;
      default:
        return ASTNodeTypes.Identifier;
    }
  }

  // --------- small helpers (no regex) ---------

  private hasIndexing(s: string): boolean {
    return s.includes("[") && s.includes("]");
  }

  private hasParenCall(s: string): boolean {
    return s.includes("(") && s.includes(")");
  }

  private hasAnyExactCall(codeLower: string, names: string[]): boolean {
    for (const n of names) {
      if (codeLower.includes(`${n}(`)) return true;
    }
    return false;
  }

  private hasAssignment(s: string): boolean {
    const i = s.indexOf("=");
    if (i === -1) return false;
    const prev = i > 0 ? s[i - 1] : "";
    const next = i + 1 < s.length ? s[i + 1] : "";
    if (prev === "=" || prev === "!" || prev === "<" || prev === ">") return false;
    if (next === "=") return false;
    return true;
  }
}
