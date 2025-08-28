# dfg/extractor.py
from __future__ import annotations

import json
import os
from typing import Dict, List, Optional

from src.cpg.types import DFGOptions, Edge, Graph, Node, TypedCPG


class DFGExtractor:
    """
    Builds node-link JSON DFGs from a TypedCPG.
    - No external graph library
    - Whole-program or per-method
    """

    def __init__(self, options: Optional[DFGOptions] = None) -> None:
        self.options = options or DFGOptions()

    # ---------- Whole program ----------

    def build_whole(self, typed: TypedCPG) -> Graph:
        """Single DFG for the entire program; includes only nodes present in kept edges."""
        links: List[Edge] = []
        touched: set[str] = set()

        for e in typed.edges:
            if e.label not in self.options.labels:
                continue
            if self.options.intraprocedural_only:
                m_src = (
                    typed.nodes[e.src].method_full_name
                    if (e.src in typed.nodes and typed.nodes[e.src] is not None)
                    else None
                )
                m_dst = (
                    typed.nodes[e.dst].method_full_name
                    if (e.dst in typed.nodes and typed.nodes[e.dst] is not None)
                    else None
                )
                if m_src and m_dst and m_src != m_dst:
                    continue

            links.append(Edge(source=e.src, target=e.dst, label=e.label.value))
            touched.update((e.src, e.dst))

        nodes: List[Node] = [self._pack_node(typed, nid) for nid in touched]
        return Graph(directed=True, multigraph=False, nodes=nodes, links=links)

    # ---------- Per method ----------

    def build_per_method(self, typed: TypedCPG) -> Dict[str, Graph]:
        """One DFG per method. Key is methodFullName or '__UNKNOWN__'."""
        by_method_nodes: Dict[str, set[str]] = {}
        for nid, a in typed.nodes.items():
            key = (
                a.method_full_name if a.method_full_name is not None else "__UNKNOWN__"
            )
            by_method_nodes.setdefault(key, set()).add(nid)

        by_method_links: Dict[str, List[Edge]] = {m: [] for m in by_method_nodes}
        incident: Dict[str, set[str]] = {m: set() for m in by_method_nodes}

        for e in typed.edges:
            if e.label not in self.options.labels:
                continue
            m_src = (
                typed.nodes[e.src].method_full_name
                if (e.src in typed.nodes and typed.nodes[e.src] is not None)
                else None
            )
            m_dst = (
                typed.nodes[e.dst].method_full_name
                if (e.dst in typed.nodes and typed.nodes[e.dst] is not None)
                else None
            )
            if self.options.intraprocedural_only and m_src and m_dst and m_src != m_dst:
                continue

            bucket = (
                m_src
                if (m_src == m_dst and m_src is not None)
                else (m_src or m_dst or "__UNKNOWN__")
            )
            if bucket not in by_method_nodes:
                continue
            if (
                e.src not in by_method_nodes[bucket]
                or e.dst not in by_method_nodes[bucket]
            ):
                continue

            by_method_links[bucket].append(
                Edge(source=e.src, target=e.dst, label=e.label.value)
            )
            incident[bucket].update((e.src, e.dst))

        out: Dict[str, Graph] = {}
        for m, node_ids in by_method_nodes.items():
            keep_ids = (
                node_ids if self.options.include_isolated else (node_ids & incident[m])
            )
            nodes = [self._pack_node(typed, nid) for nid in sorted(keep_ids)]
            links = by_method_links[m]
            if nodes or links:
                out[m] = Graph(
                    directed=True, multigraph=False, nodes=nodes, links=links
                )
        return out

    # ---------- I/O ----------

    @staticmethod
    def write_json(obj: Graph, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2, ensure_ascii=False)

    # ---------- internals ----------

    def _pack_node(self, typed: TypedCPG, nid: str) -> Node:
        a = typed.nodes[nid]
        node: Node = {"id": nid}
        if "code" in self.options.keep_fields:
            node["code"] = a.code
        if "line" in self.options.keep_fields:
            node["line"] = a.line
        if "methodFullName" in self.options.keep_fields:
            node["methodFullName"] = a.method_full_name
        return node
