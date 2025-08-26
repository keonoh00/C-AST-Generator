import json, re, math, argparse, random
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Set

import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader

# ----------------------------
# AST v1.0 extractor
# ----------------------------

# call extraction & semantic category from code ----------
# 제어 키워드/유틸은 호출로 취급하지 않도록 블록리스트
CALL_NAME_BLOCKLIST = {"if","for","while","switch","return","sizeof","NULL"}

def extract_called_names(code: str) -> List[str]:
    names: List[str] = []
    for m in re.finditer(r'\b([A-Za-z_]\w*)\s*\(', code or ""):
        name = m.group(1)
        if name not in CALL_NAME_BLOCKLIST:
            names.append(name)
    return names

# 우선순위: mem_copy > ext_input > mem_alloc > format_print > none
CALL_PRIORITY: List[str] = ["mem_copy", "ext_input", "mem_alloc", "format_print"]

CALL_SEM_ORDER = ["none","mem_alloc","mem_copy","ext_input","format_print"]
CALL_SEM = {
    "mem_alloc": {"malloc","calloc","realloc","alloca"},
    "mem_copy": {"memcpy","memmove","strcpy","strcat","snprintf","sprintf"},
    "ext_input": {"fgets","gets","scanf","fscanf","getline","read","recv"},
    "format_print": {"printf","puts","printIntLine","printLine"},
}

KEEP_TYPES = {
    "VariableDeclaration","ArrayDeclaration","AssignmentExpression",
    "IfStatement","ElseStatement","ForStatement","WhileStatement",
    "UserDefinedCall","CallExpression","ExpressionStatement"
}


def parse_array_size_const(code: str) -> float:
    dims = re.findall(r'\[(\d+)\]', code)
    if not dims:
        return 0.0
    prod = 1
    for d in dims:
        prod *= int(d)
    return norm_val(prod)

def get_name_hint(node: Dict[str,Any]) -> str:
    return node.get("name","") or node.get("spelling","") or ""

def norm_val(n: Optional[int], cap: int = 100) -> float:
    if n is None:
        return 0.0
    return min(max(int(n),0), cap)/float(cap)


def is_buffer_access_code(code: str) -> bool:
    if re.search(r'\b\w+\s*\[[^]]+\]', code):
        return True
    if re.search(r'\*\s*\([^)]*\+[^)]*\)', code):  # *(p+i)
        return True
    return False



def call_sem_cat_id_from_code(code: str) -> int:
    seen = set(extract_called_names(code))
    for cat in CALL_PRIORITY:
        if any(n in CALL_SEM[cat] for n in seen):
            return CALL_SEM_ORDER.index(cat)  # 1..4
    return 0  # none



def call_sem_cat_id_for_name(name: str) -> int:
    name = (name or "").strip()
    for cat in CALL_SEM:
        if name in CALL_SEM[cat]:
            return CALL_SEM_ORDER.index(cat)
    return 0

def guards_from_condition(cond_code: str) -> Dict[str, Dict[str,Any]]:
    res: Dict[str, Dict[str,Any]] = {}
    for m in re.finditer(r'\b([A-Za-z_]\w*)\s*>\s*=\s*0|\b([A-Za-z_]\w*)\s*>\s*0', cond_code):
        var = m.group(1) or m.group(2)
        if var:
            res.setdefault(var, {"lower":0,"upper":0,"upper_const":0.0})
            res[var]["lower"] = 1
    for m in re.finditer(r'\b([A-Za-z_]\w*)\s*<\s*=\s*(\d+)|\b([A-Za-z_]\w*)\s*<\s*(\d+)', cond_code):
        var = m.group(1) or m.group(3)
        val = m.group(2) or m.group(4)
        if var and val:
            res.setdefault(var, {"lower":0,"upper":0,"upper_const":0.0})
            res[var]["upper"] = 1
            res[var]["upper_const"] = norm_val(int(val))
    return res

class ASTExtractorV1:
    def __init__(self, ast_json: Dict[str,Any]):
        self.ast = ast_json
        self.nodes: List[Dict[str,Any]] = []
        self.edges_pc: List[Tuple[int,int,int]] = []
        self.edges_sb: List[Tuple[int,int,int]] = []
        self.edges_guard: List[Dict[str,Any]] = []
        self.sid_counter = 1
        self.var_names: Set[str] = set()

        func_name = self.ast.get("name","<func>")
        # ★ orig_id 보존 (가능하면 함수 원본 id, 없으면 None)
        func_orig_id = self.ast.get("id") if isinstance(self.ast.get("id"), int) else None
        self.nodes.append({
            "sid": 0,
            "node_type": "FunctionEntry",
            "code": f"<entry:{func_name}>",
            "node_type_id": "FunctionEntry",
            "call_sem_cat_id": 0,
            "in_loop": 0,
            "is_loop": 0,
            "ctx_guard_strength": 0,
            "ctx_upper_bound_norm": 0.0,
            "is_buffer_decl": 0,
            "buffer_size_const": 0.0,
            "alloc_has_sizeof": 0,
            "orig_id": func_orig_id,   # ★ 추가
        })

    # ★ orig_id 인자를 추가해 원본 AST id를 함께 저장
    def _make_node(self, node_type: str, code: str, in_loop: int, is_loop: int,
                    guard_lower: int, guard_upper: int, upper_norm: float, name_hint: str = "",
                    orig_id: Optional[int] = None) -> int:
        sid = self.sid_counter; self.sid_counter += 1

        # PATCH: 문장 내부 호출도 의미 카테고리로 요약(If/Assign 등 포함)
        call_sem_cat_id = call_sem_cat_id_from_code(code)

        is_buf_decl = 1 if node_type=="ArrayDeclaration" else 0
        buf_size = parse_array_size_const(code) if is_buf_decl else 0.0
        alloc_has_sizeof = 1 if call_sem_cat_id==CALL_SEM_ORDER.index("mem_alloc") and "sizeof" in code else 0
        ctx_strength = (1 if guard_lower else 0) + (2 if guard_upper else 0)
        row = {
            "sid": sid,
            "node_type": node_type,
            "code": code.strip(),
            "node_type_id": node_type,
            "call_sem_cat_id": call_sem_cat_id,
            "in_loop": in_loop,
            "is_loop": is_loop,
            "ctx_guard_strength": ctx_strength,
            "ctx_upper_bound_norm": (upper_norm if guard_upper else 0.0),
            "is_buffer_decl": is_buf_decl,
            "buffer_size_const": buf_size,
            "alloc_has_sizeof": alloc_has_sizeof,
            "orig_id": orig_id,   # ★ 추가: 원본 AST 노드 id 저장
        }
        self.nodes.append(row)
        return sid

    def _process_block(self, block_node: Dict[str,Any], parent_sid: int,
                   active_guards: Dict[str, Dict[str,Any]], in_loop: int) -> Tuple[Optional[int], Optional[int]]:
        """
        Returns: (first_sid, last_sid) of this block
        - first_sid: 이 블록에서 처음으로 생성된 statement sid
        - last_sid : 이 블록에서 마지막으로 생성된 statement sid
        """
        sb_prev: Optional[int] = None            # 이 블록 내 마지막 statement sid (SB 연결을 위해 유지)
        first_sid: Optional[int] = None          # 이 블록의 첫 statement sid

        for ch in block_node.get("children", []):
            t = ch.get("nodeType")

            # 중첩 블록 { ... }
            if t == "CompoundStatement":
                child_first, child_last = self._process_block(ch, parent_sid, dict(active_guards), in_loop)
                if child_first is not None:
                    # 이전 문장 → (자식 블록의) 첫 문장
                    if sb_prev is not None:
                        self.edges_sb.append((sb_prev, child_first, 1))   # AST_SB
                    # 블록의 첫 문장 설정
                    if first_sid is None:
                        first_sid = child_first
                    # 이 블록의 sb_prev는 자식 블록의 마지막 문장으로 갱신
                    sb_prev = child_last
                continue

            # IfStatement
            if t == "IfStatement":
                sid_if = self._make_node("IfStatement", ch.get("code",""), in_loop, 0, 0, 0, 0.0,
                                         orig_id=ch.get("id"))  # ★ orig_id 전달
                self.edges_pc.append((parent_sid, sid_if, 0))            # AST_PC
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_if, 1))           # AST_SB
                if first_sid is None:
                    first_sid = sid_if
                sb_prev = sid_if  # if 구조 전체의 '대표'로써 다음 형제와 SB 연결

                cond_code = ch.get("children",[{}])[0].get("code","")
                cond_guards = guards_from_condition(cond_code)
                then_block = ch.get("children",[None,None,None])[1]
                else_block = ch.get("children",[None,None,None])[2]

                # THEN
                if then_block and then_block.get("nodeType") == "CompoundStatement":
                    pushed = dict(active_guards)
                    for v,g in cond_guards.items():
                        pushed[v] = {
                            "lower": g.get("lower",0),
                            "upper": g.get("upper",0),
                            "upper_const": g.get("upper_const",0.0),
                            "kind": "if"
                        }
                    then_first, _then_last = self._process_block(then_block, sid_if, pushed, in_loop)
                    if then_first is not None:
                        self.edges_guard.append({
                            "src": sid_if, "dst": then_first, "edge_type": 2,
                            "guard_kind": 1,      # 1=if
                            "guard_branch": 0     # 0=then
                        })

                # ELSE
                if else_block and else_block.get("nodeType") == "CompoundStatement":
                    else_first, _else_last = self._process_block(else_block, sid_if, dict(active_guards), in_loop)
                    if else_first is not None:
                        self.edges_guard.append({
                            "src": sid_if, "dst": else_first, "edge_type": 2,
                            "guard_kind": 1,      # 1=if
                            "guard_branch": 1     # 1=else
                        })
                continue

            # ForStatement
            if t == "ForStatement":
                sid_for = self._make_node("ForStatement", ch.get("code",""), in_loop, 1, 0, 0, 0.0,
                                          orig_id=ch.get("id"))  # ★ orig_id 전달
                self.edges_pc.append((parent_sid, sid_for, 0))           # AST_PC
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_for, 1))          # AST_SB
                if first_sid is None:
                    first_sid = sid_for
                sb_prev = sid_for  # for 구조 전체의 '대표'로써 다음 형제와 SB 연결

                kids = ch.get("children", [])
                cond = kids[1] if len(kids) > 1 else None
                cond_code = cond.get("code","") if cond else ""
                lguards = guards_from_condition(cond_code)

                pushed = dict(active_guards)
                for v,g in lguards.items():
                    pushed[v] = {
                        "lower": g.get("lower",0),
                        "upper": g.get("upper",0),
                        "upper_const": g.get("upper_const",0.0),
                        "kind": "loop"
                    }

                body = kids[3] if len(kids) > 3 else None
                if body and body.get("nodeType") == "CompoundStatement":
                    body_first, _body_last = self._process_block(body, sid_for, pushed, 1)
                    if body_first is not None:
                        self.edges_guard.append({
                            "src": sid_for, "dst": body_first, "edge_type": 2,
                            "guard_kind": 2,      # 2=loop
                            "guard_branch": 2     # 2=loop-body
                        })
                continue

            # 유지 대상이 아닌 타입 스킵
            if t not in KEEP_TYPES:
                continue

            # 일반 statement
            code = ch.get("code","")
            name_hint = get_name_hint(ch)
            any_lower = 1 if any(g.get("lower",0)==1 for g in active_guards.values()) else 0
            any_upper = 1 if any(g.get("upper",0)==1 for g in active_guards.values()) else 0
            upper_norm = max((g.get("upper_const",0.0) for g in active_guards.values()), default=0.0)

            # ★ 모든 일반 statement에도 원본 id 전달
            sid_cur = self._make_node(t, code, in_loop, 0, any_lower, any_upper, upper_norm,
                                      name_hint=name_hint, orig_id=ch.get("id"))
            self.edges_pc.append((parent_sid, sid_cur, 0))               # AST_PC
            if sb_prev is not None:
                self.edges_sb.append((sb_prev, sid_cur, 1))              # AST_SB
            if first_sid is None:
                first_sid = sid_cur
            sb_prev = sid_cur

        # 블록의 (첫,마지막) sid 반환
        return first_sid, sb_prev

    def run(self) -> Dict[str,Any]:
        func_body = None
        for c in self.ast.get("children", []):
            if c.get("nodeType") == "CompoundStatement":
                func_body = c
                break
        _first, _last = self._process_block(func_body, 0, {}, 0)
        return {
            "nodes": self.nodes,
            "edges_ast_pc": self.edges_pc,
            "edges_ast_sb": self.edges_sb,
            "edges_ast_guard": self.edges_guard
        }




