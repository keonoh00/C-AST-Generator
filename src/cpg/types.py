# cpg/types.py
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, List, Mapping, Optional, Set, Tuple, TypedDict

# ---- Core enums ----


class EdgeLabel(str, Enum):
    REACHING_DEF = "REACHING_DEF"
    DATA_FLOW = "DATA_FLOW"
    DDG_EDGE = "DDG_EDGE"
    OTHER = "OTHER"


# ---- Typed CPG containers (normalized) ----


@dataclass(frozen=True)
class NodeAttr:
    """Normalized vertex attributes we care about."""

    code: Optional[str]
    line: Optional[int]
    method_full_name: Optional[str]
    label: str  # raw vertex label (e.g., IDENTIFIER, CALL, ...)
    raw: Mapping[str, Any]  # original GraphSON vertex (for debugging)


@dataclass(frozen=True)
class EdgeRec:
    """Normalized edge record."""

    src: str
    dst: str
    label: EdgeLabel
    raw: Mapping[str, Any]  # original GraphSON edge (for debugging)


@dataclass(frozen=True)
class TypedCPG:
    """Normalized, typed CPG view used by the extractor."""

    nodes: Mapping[str, NodeAttr]  # id -> NodeAttr
    edges: List[EdgeRec]  # all edges (we’ll filter DFG labels later)


# ---- Verification reporting ----


@dataclass(frozen=True)
class Issue:
    severity: str  # "ERROR" | "WARN" | "INFO"
    message: str


@dataclass(frozen=True)
class Report:
    ok: bool
    issues: List[Issue]


# ---- DFG output (node-link JSON) ----


class Node(TypedDict, total=False):
    id: str
    code: Optional[str]
    line: Optional[int]
    methodFullName: Optional[str]


class Edge(TypedDict, total=False):
    source: str
    target: str
    label: str


class Graph(TypedDict, total=False):
    directed: bool
    multigraph: bool
    nodes: List[Node]
    links: List[Edge]


# ---- DFG options ----


@dataclass(frozen=True)
class DfgOptions:
    """Controls what edges/nodes are kept in the DFG JSON."""

    labels: Set[EdgeLabel] = frozenset(
        {
            EdgeLabel.REACHING_DEF,
            EdgeLabel.DATA_FLOW,
            EdgeLabel.DDG_EDGE,
        }
    )
    intraprocedural_only: bool = False
    include_isolated: bool = False  # used by per-method build
    keep_fields: Tuple[str, ...] = ("code", "line", "methodFullName")
