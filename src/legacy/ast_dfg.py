import argparse
import json
import math
import random
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import torch
from ASTExtractorV1_11h import ASTExtractorV1_1
from DFGExtractorV1_12j import DFGExtractorV1_12
from torch import nn
from torch.utils.data import DataLoader, Dataset

RANDOM_SEED = 1337
random.seed(RANDOM_SEED)
torch.manual_seed(RANDOM_SEED)


# ----------------------------
# PyG graph builders
# ----------------------------
import numpy as np


def build_ast_pyg(ast_result: Dict[str, Any]):
    import numpy as np
    import torch

    def one_hot(i: int, n: int):
        v = [0.0] * n
        if 0 <= i < n:
            v[i] = 1.0
        return v

    # ---------- Node features ----------
    nodes = ast_result["nodes"]
    feats = []
    for n in nodes:
        feats.append(
            [
                (hash(n["node_type_id"]) % 1000) / 1000.0,  # node_type_id (hash-norm)
                n.get("call_sem_cat_id", 0) / 5.0,  # call_sem_cat_id (enum norm)
                float(n.get("in_loop", 0)),
                float(n.get("is_loop", 0)),
                float(n.get("ctx_guard_strength", 0)) / 3.0,  # 0..3 -> 0..1
                float(n.get("ctx_upper_bound_norm", 0.0)),
                float(n.get("is_buffer_decl", 0)),
                float(n.get("buffer_size_const", 0.0)),
                float(n.get("alloc_has_sizeof", 0)),
            ]
        )
    x = torch.tensor(feats, dtype=torch.float)

    # ---------- Edge index & edge attrs ----------
    # edge_attr = [ edge_type(3) | guard_kind(3) | guard_branch(3) ]  -> total 9 dims (float)
    edges = []
    eattrs = []

    # 1) AST_PC (tuple edges: (src, dst, 0))
    for src, dst, _t in ast_result.get("edges_ast_pc", []):
        edges.append([src, dst])
        eattrs.append(one_hot(0, 3) + [0.0, 0.0, 0.0] + [0.0, 0.0, 0.0])

    # 2) AST_SB (tuple edges: (src, dst, 1))
    for src, dst, _t in ast_result.get("edges_ast_sb", []):
        edges.append([src, dst])
        eattrs.append(one_hot(1, 3) + [0.0, 0.0, 0.0] + [0.0, 0.0, 0.0])

    # 3) AST_Guard (dict edges: {"src","dst","edge_type":2,"guard_kind","guard_branch"})
    for g in ast_result.get("edges_ast_guard", []):
        src = g["src"] if isinstance(g, dict) else g[0]
        dst = g["dst"] if isinstance(g, dict) else g[1]
        guard_kind = (
            int(g.get("guard_kind", 0)) if isinstance(g, dict) else 0
        )  # 0 none, 1 if, 2 loop
        guard_branch = (
            int(g.get("guard_branch", 0)) if isinstance(g, dict) else 0
        )  # 0 then, 1 else, 2 loop-body
        edges.append([src, dst])
        eattrs.append(one_hot(2, 3) + one_hot(guard_kind, 3) + one_hot(guard_branch, 3))

    if edges:
        edge_index = torch.tensor(np.array(edges).T, dtype=torch.long)
        edge_attr = torch.tensor(np.array(eattrs), dtype=torch.float)
    else:
        edge_index = torch.empty((2, 0), dtype=torch.long)
        edge_attr = torch.empty((0, 9), dtype=torch.float)

    return x, edge_index, edge_attr


def build_dfg_pyg(dfg_result: Dict[str, Any]):
    import numpy as np
    import torch

    def one_hot(i: int, n: int):
        v = [0.0] * n
        if 0 <= i < n:
            v[i] = 1.0
        return v

    # ---------- Node features ----------
    nodes = dfg_result["nodes"]
    feats = []
    for n in nodes:
        feats.append(
            [
                (hash(n["node_type_id"]) % 1000) / 1000.0,  # node_type_id (hash-norm)
                float(n.get("is_buffer_access", 0)),  # buffer[index] 등 접근 여부
                float(
                    n.get("is_sink", 0)
                ),  # sink 태그(집합: buffer_access ∪ risky_call)
                float(n.get("in_degree_dfg", 0)),  # DFG in-degree
                float(n.get("out_degree_dfg", 0)),  # DFG out-degree
            ]
        )
    x = torch.tensor(feats, dtype=torch.float)

    # ---------- Edge index & edge attrs ----------
    # edge_attr = [ flow_id(4) | has_lower | has_upper | upper_norm | guard_kind(3) ] => 10 dims
    edges = []
    eattrs = []
    for src, dst, attr in dfg_result.get("edges_dfg", []):
        edges.append([src, dst])
        flow_oh = one_hot(int(attr.get("flow_id", 1)) - 1, 4)  # 0..3
        lower = float(attr.get("has_lower_guard", 0))
        upper = float(attr.get("has_upper_guard", 0))
        upn = float(attr.get("upper_guard_norm", 0.0))
        gk_oh = one_hot(int(attr.get("guard_kind", 0)), 3)  # 0 none, 1 if, 2 loop
        eattrs.append(flow_oh + [lower, upper, upn] + gk_oh)

    if edges:
        edge_index = torch.tensor(np.array(edges).T, dtype=torch.long)
        edge_attr = torch.tensor(np.array(eattrs), dtype=torch.float)
    else:
        edge_index = torch.empty((2, 0), dtype=torch.long)
        edge_attr = torch.empty((0, 10), dtype=torch.float)

    return x, edge_index, edge_attr


# ----------------------------
# Dataset + collate
# ----------------------------


class FuncGraph:
    def __init__(self, ast_path: Path, label: int, sink_mode: str = "k1"):
        with open(ast_path, "r", encoding="utf-8") as f:
            ast_json = json.load(f)
        ast_ext = ASTExtractorV1_1(ast_json)
        ast_result = ast_ext.run()
        dfg_ext = DFGExtractorV1_12(ast_json, ast_result, sink_mode=sink_mode)
        dfg_result = dfg_ext.run()
        self.ast_result = ast_result
        self.dfg_result = dfg_result
        self.label = label


# ----------------------------
# main()
# ----------------------------
def main():
    p = argparse.ArgumentParser()

    # p.add_argument("--bad", type=str, default="data/CWE121_CWE129_fgets_01_bad.json")
    # p.add_argument("--bad", type=str, default="data/CWE121_CWE129_fgets_01_goodG2B.json")

    # p.add_argument("--bad", type=str, default="data/CWE121_type_overrun_memmove_01_bad.json")
    # p.add_argument("--bad", type=str, default="data/CWE121_type_overrun_memmove_01_good.json")

    # p.add_argument("--bad", type=str, default="data/CWE121_CWE131_loop_01_bad.json")
    p.add_argument("--bad", type=str, default="data/CWE121_CWE131_loop_01_goodG2B.json")

    args = p.parse_args()

    graph = FuncGraph(Path(args.bad), label=1)

    result = {
        "file": args.bad,
        "label": graph.label,
        "ast_result": graph.ast_result,
        "dfg_result": graph.dfg_result,
    }

    out_path = "result.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
