# cpg/verification.py
from __future__ import annotations

import json
from typing import Any, Dict, List, Mapping, Optional, Tuple

from src.cpg.types import EdgeLabel, EdgeRec, Issue, NodeAttr, Report, TypedCPG


class Verifier:
    """
    Loads a Joern CPG exported as GraphSON and normalizes it into TypedCPG.
    GraphSON shape expected:
      { "export": { "@value": { "vertices": [...], "edges": [...] } } }
    """

    # ---- public API ----

    def verify_and_type(self, path: str) -> Tuple[TypedCPG, Report]:
        root = self._load_graphson_root(path)
        issues: List[Issue] = []

        vertices = root.get("vertices")
        edges = root.get("edges")

        if not isinstance(vertices, list) or not vertices:
            issues.append(
                Issue("ERROR", "No vertices found under export.@value.vertices")
            )
        if not isinstance(edges, list) or not edges:
            issues.append(Issue("WARN", "No edges found under export.@value.edges"))

        if any(i.severity == "ERROR" for i in issues):
            return TypedCPG(nodes={}, edges=[]), Report(ok=False, issues=issues)

        typed = self._normalize(vertices, edges)

        if not typed.nodes:
            issues.append(Issue("ERROR", "TypedCPG has zero nodes after normalization"))
        if not typed.edges:
            issues.append(Issue("WARN", "TypedCPG has zero edges after normalization"))

        return typed, Report(
            ok=not any(i.severity == "ERROR" for i in issues), issues=issues
        )

    # ---- internals ----

    def _load_graphson_root(self, path: str) -> Mapping[str, Any]:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        export = data.get("export", {})
        root = export.get("@value", {})
        if not isinstance(root, dict):
            return {}
        return root

    def _normalize(
        self, vertices: List[Mapping[str, Any]], edges: List[Mapping[str, Any]]
    ) -> TypedCPG:
        nodes: Dict[str, NodeAttr] = {}
        for v in vertices:
            vid = self._str(self._at(v, ["id", "@value"]))
            label = str(v.get("label", ""))
            props = v.get("properties", {}) or {}

            code = self._first_prop(props, "CODE")
            line = self._int_or_none(self._first_prop(props, "LINE_NUMBER"))
            mfn = self._first_prop(props, "METHOD_FULL_NAME")

            nodes[vid] = NodeAttr(
                code=code,
                line=line,
                method_full_name=mfn,
                label=label,
                raw=v,
            )

        edge_list: List[EdgeRec] = []
        for e in edges:
            lbl = self._edge_label(str(e.get("label", "")))
            # keep ALL edges here; extractor will filter by labels option
            src = self._str(self._at(e, ["outV", "@value"]))
            dst = self._str(self._at(e, ["inV", "@value"]))
            edge_list.append(EdgeRec(src=src, dst=dst, label=lbl, raw=e))

        return TypedCPG(nodes=nodes, edges=edge_list)

    # ---- GraphSON helpers ----

    @staticmethod
    def _at(obj: Mapping[str, Any], path: List[str]) -> Optional[Any]:
        cur: Any = obj
        for key in path:
            if not isinstance(cur, Mapping) or key not in cur:
                return None
            cur = cur[key]
        return cur

    @staticmethod
    def _str(v: Any) -> str:
        if v is None:
            return ""
        return str(v)

    @staticmethod
    def _first_prop(props: Mapping[str, Any], key: str) -> Optional[Any]:
        """
        GraphSON v3 vertex property flattening: props[key]['@value']['@value'][0]['@value']
        """
        p = props.get(key)
        if not isinstance(p, Mapping):
            return None
        v1 = p.get("@value")
        if not isinstance(v1, Mapping):
            return None
        arr = v1.get("@value")
        if not isinstance(arr, list) or not arr:
            return None
        x = arr[0]
        if isinstance(x, Mapping) and "@value" in x:
            return x["@value"]
        return x

    @staticmethod
    def _int_or_none(v: Any) -> Optional[int]:
        if isinstance(v, int):
            return v
        if isinstance(v, str) and v.isdigit():
            return int(v)
        if isinstance(v, Mapping) and "@value" in v and isinstance(v["@value"], int):
            return int(v["@value"])
        return None

    @staticmethod
    def _edge_label(name: str) -> EdgeLabel:
        try:
            return EdgeLabel[name]
        except KeyError:
            return EdgeLabel.OTHER
