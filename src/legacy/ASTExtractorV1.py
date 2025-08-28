import argparse
import json
import math
import random
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset

# ----------------------------
# AST v1.1 extractor (AST-GNN feat/debug 분리, DFG 호환 유지)
# ----------------------------

# 호출명 추출 시 제외할 토큰
CALL_NAME_BLOCKLIST = {"if", "for", "while", "switch", "return", "sizeof", "NULL"}


def extract_called_names(code: str) -> List[str]:
    """단순 코드 문자열에서 함수 호출 명 추출 (최초 레벨)"""
    names: List[str] = []
    for m in re.finditer(r"\b([A-Za-z_]\w*)\s*\(", code or ""):
        name = m.group(1)
        if name not in CALL_NAME_BLOCKLIST:
            names.append(name)
    return names


# 우선순위: mem_copy > ext_input > mem_alloc > format_print > none
CALL_PRIORITY: List[str] = ["mem_copy", "ext_input", "mem_alloc", "format_print"]

# 카테고리 인덱스 매핑
CALL_SEM_ORDER = ["none", "mem_alloc", "mem_copy", "ext_input", "format_print"]
CALL_SEM = {
    "mem_alloc": {"malloc", "calloc", "realloc", "alloca", "ALLOCA", "_alloca"},
    "mem_copy": {
        "memcpy",
        "memmove",
        "strcpy",
        "strcat",
        "snprintf",
        "sprintf",
        "vsprintf",
        "vsnprintf",
    },
    "ext_input": {"fgets", "gets", "scanf", "fscanf", "getline", "read", "recv"},
    "format_print": {"printf", "puts", "printIntLine", "printLine"},
}

# ---- mem-alloc helpers ----
MEM_ALLOC_FUNCS_LOWER = {"malloc", "calloc", "realloc", "alloca", "_alloca"}
MEM_ALLOC_FUNCS_RAW = {"ALLOCA", "new[]"}  # 대소문자 보존 토큰


def _is_mem_alloc_name(fname: str) -> bool:
    f = (fname or "").strip()
    fl = f.lower()
    return (fl in MEM_ALLOC_FUNCS_LOWER) or (f in MEM_ALLOC_FUNCS_RAW)


def _node_contains_sizeof(n: Any) -> bool:
    """AST 노드 트리 내부에 sizeof 사용 흔적이 있는지 (보수적) 탐지."""
    if not isinstance(n, dict):
        return False
    code = n.get("code") or ""
    if "sizeof" in code:
        return True
    for c in n.get("children") or []:
        if _node_contains_sizeof(c):
            return True
    return False


def _unwrap_cast_paren(n: Any) -> Any:
    """CastExpression/CStyleCastExpr/ParenExpression 래퍼를 벗겨 RHS의 실질 표현식으로 이동"""
    while isinstance(n, dict) and n.get("nodeType") in {
        "CastExpression",
        "CStyleCastExpr",
        "ParenExpression",
        "ParenExpr",
    }:
        kids = n.get("children") or []
        n = kids[0] if kids else n
    return n


# 유지할 노드 유형 (statement level)
KEEP_TYPES = {
    "VariableDeclaration",
    "ArrayDeclaration",
    "PointerDeclaration",
    "AssignmentExpression",
    "IfStatement",
    "ForStatement",
    "WhileStatement",
    "SwitchStatement",
    "StandardLibCall",
    "UserDefinedCall",
}


# 무제한 쓰기 계열
UNBOUNDED = {"gets", "strcpy", "strcat", "sprintf", "vsprintf"}
# 표준 라이브러리 호출 판별(간단): CALL_SEM 집합들과 UNBOUNDED 합집합 기반
STD_FUNCTIONS = set().union(*CALL_SEM.values(), UNBOUNDED)


def _first_called_name_from_node(node: dict) -> str:
    """AST 노드(주로 CallExpression)의 code에서 첫 호출 명을 추출"""
    code = node.get("code", "") if isinstance(node, dict) else ""
    for m in re.finditer(r"\b([A-Za-z_]\w*)\s*\(", code):
        name = m.group(1)
        if name not in CALL_NAME_BLOCKLIST:
            return name
    return ""


def _classify_call_name(name: str) -> str:
    """호출명을 표준/사용자 정의로 분류"""
    if not name:
        return "CallExpression"
    return "StandardLibCall" if name in STD_FUNCTIONS else "UserDefinedCall"


def norm_val(n: Optional[int], cap: int = 100) -> float:
    """0..cap을 0..1로 정규화. None/음수는 0.0"""
    if n is None:
        return 0.0
    return min(max(int(n), 0), cap) / float(cap)


def _strip_sizeof(s: str) -> str:
    """문자열에서 sizeof(...) 블록을 제거해 식별자 탐지 오탐을 줄임"""
    out = []
    i = 0
    L = len(s)
    depth = 0
    in_sizeof = False
    while i < L:
        if not in_sizeof and s.startswith("sizeof", i):
            j = i + 6
            while j < L and s[j].isspace():
                j += 1
            if j < L and s[j] == "(":
                in_sizeof = True
                depth = 0
                i = j
                # 균형 괄호 스킵
                while i < L:
                    if s[i] == "(":
                        depth += 1
                    elif s[i] == ")":
                        depth -= 1
                        if depth == 0:
                            i += 1
                            break
                    i += 1
                continue
        out.append(s[i])
        i += 1
    return "".join(out)


def parse_array_size_state_and_norm(code: str) -> Tuple[int, float]:
    """
    배열 선언 문자열에서 (buffer_size_state, buffer_size_norm) 계산
      - state: 0=NA(배열 아님), 1=CONST, 2=NONCONST
      - norm : CONST일 때 정규화 값, 그 외 0.0
    """
    dims = re.findall(r"\[[^\]]+\]", code or "")
    if not dims:
        return 0, 0.0
    nonconst = False
    product = 1
    evaluable = True
    for d in dims:
        expr = d.strip()[1:-1]
        expr_wo_sizeof = _strip_sizeof(expr)
        if re.search(r"[A-Za-z_]\w*", expr_wo_sizeof):
            nonconst = True
        if re.fullmatch(r"\d+", expr.strip()):
            product *= int(expr.strip())
        else:
            evaluable = False
    if nonconst:
        return 2, 0.0
    # CONST
    if evaluable:
        return 1, norm_val(product)
    else:
        return 1, 0.0


def call_sem_cat_id_from_name(name: str) -> int:
    """
    함수명으로 호출 카테고리 추정.
    반환값: 0:none, 1:mem_alloc, 2:mem_copy, 3:ext_input, 4:format_print
    """
    if not isinstance(name, str) or not name:
        return 0
    for cat in CALL_PRIORITY:
        if name in CALL_SEM[cat]:
            return CALL_SEM_ORDER.index(cat)  # 1..4
    return 0


def call_sem_cat_id_from_code(code: str) -> int:
    """
    코드 문자열에서 호출 카테고리 추정 (우선순위 적용)
    반환값: 0:none, 1:mem_alloc, 2:mem_copy, 3:ext_input, 4:format_print
    """
    seen = set(extract_called_names(code))
    for cat in CALL_PRIORITY:
        if any(n in CALL_SEM[cat] for n in seen):
            return CALL_SEM_ORDER.index(cat)  # 1..4
    return 0  # none


def _find_matching_paren(s: str, start: int) -> int:
    """문자열 s에서 start 위치의 '('에 대응하는 ')' 인덱스 반환 (없으면 -1)"""
    depth = 0
    for i in range(start, len(s)):
        c = s[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
    return -1


def _simple_parse_args(code: str, fname: str) -> List[str]:
    """code에서 fname( ... )의 최초 호출 인자 목록을 best-effort로 파싱"""
    pattern = r"\b" + re.escape(fname) + r"\s*\("
    m = re.search(pattern, code or "")
    if not m:
        return []
    l = m.end() - 1
    r = _find_matching_paren(code, l)
    if r == -1:
        return []
    inner = code[l + 1 : r]
    # 최상위 콤마로 분리
    args = []
    cur = []
    depth = 0
    for ch in inner:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            args.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
    if cur:
        args.append("".join(cur).strip())
    return args


def _ident_name(s: str) -> str:
    """문자열에서 첫 식별자 토큰만 추출"""
    m = re.search(r"\b([A-Za-z_]\w*)\b", s or "")
    return m.group(1) if m else ""


def compute_call_flags(code: str, fname: str | None = None) -> Dict[str, int]:

    def _dst_shape(dst_txt: str):
        """dst 형태 식별: (shape, base, field)
        shape ∈ {"ident","field","indexed","deref"}"""
        s = (dst_txt or "").strip()
        m = re.match(r"^([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)$", s)
        if m:
            return "field", m.group(1), m.group(2)
        if re.match(r"^[A-Za-z_]\w*\s*\[", s):
            return "indexed", None, None
        if s.startswith("*"):
            return "deref", None, None
        if re.match(r"^[A-Za-z_]\w*$", s):
            return "ident", s, None
        return "ident", _ident_name(s), None  # 마지막 보루

    def _size_kind(size_txt: str) -> int:
        """0:none, 1:literal, 2:ident, 3:sizeof, 4:arith"""
        if not size_txt or not size_txt.strip():
            return 0
        s = size_txt.strip()
        if "sizeof" in s:
            return 3
        if re.fullmatch(r"\d+", s):
            return 1
        if re.search(r"[+\-*/]", s):
            return 4
        if re.search(r"\b[A-Za-z_]\w*\b", s):
            return 2
        return 0

    flags = {
        "call_flag_danger_unbounded": 0,
        "call_flag_len_linked_to_dst": 0,
        "call_flag_sizeof_non_dst": 0,
        "call_flag_has_varargs": 0,
        "alloc_sizeof_state": 0,
        # --- NEW (AST 보강 피처) ---
        "call_dst_is_field": 0,
        "call_size_kind": 0,
        "call_len_linked_to_dst_extended": 0,
        "call_size_is_sizeof_base_struct": 0,
        "call_size_mismatch_field": 0,
    }

    low = fname.lower()

    # varargs
    if low in {"printf", "sprintf", "snprintf", "vprintf", "vsprintf", "vsnprintf"}:
        flags["call_flag_has_varargs"] = 1

    # 위험(unbounded)
    if low in UNBOUNDED:
        flags["call_flag_danger_unbounded"] = 1

    # alloc sizeof state
    if low in {
        "malloc",
        "calloc",
        "realloc",
        "alloca",
        "_alloca",
        "ALLOCA",
        "new",
        "new[]",
    }:
        args = _simple_parse_args(code, fname)
        arg_code = ",".join(args)
        if re.search(r"\bsizeof\s*\(", arg_code):
            flags["alloc_sizeof_state"] = 2  # YES
        else:
            flags["alloc_sizeof_state"] = 1  # NO

    # bounded: dst/size 추출 후 필드 감도 & 확장 len_linked/불일치 판정
    bounded = {
        "memcpy",
        "memmove",
        "strncpy",
        "snprintf",
        "vsnprintf",
        "fgets",
        "read",
        "recv",
        "getline",
    }
    if low in bounded:
        args = _simple_parse_args(code, fname)
        dst, size = "", ""
        if low in {"memcpy", "memmove", "strncpy"} and len(args) >= 3:
            dst, size = args[0], args[2]
        elif low in {"snprintf", "vsnprintf"} and len(args) >= 2:
            dst, size = args[0], args[1]
        elif low in {"fgets"} and len(args) >= 2:
            dst, size = args[0], args[1]
        elif low in {"read", "recv"} and len(args) >= 3:
            dst, size = args[1], args[2]
        elif low in {"getline"} and len(args) >= 2:
            dst, size = args[0], args[1]

        # NEW: dst/size 형태 분석
        shape, base_name, field_name = _dst_shape(dst)
        if shape == "field":
            flags["call_dst_is_field"] = 1
        flags["call_size_kind"] = _size_kind(size)

        # len_linked 기본: sizeof(dst) | sizeof(*dst) | sizeof(dst[0])
        if size:
            dst_name = _ident_name(dst)
            linked_basic = (
                bool(dst_name)
                and re.search(
                    rf"\bsizeof\s*\(\s*(\*{re.escape(dst_name)}|{re.escape(dst_name)}\s*(?:\[\s*0\s*\])?)\s*\)",
                    size,
                )
                is not None
            )
            if linked_basic:
                flags["call_flag_len_linked_to_dst"] = 1

            # 확장: dst가 base.field일 때 sizeof(base.field)
            linked_ext = False
            if shape == "field" and base_name and field_name:
                pat_field = rf"\bsizeof\s*\(\s*{re.escape(base_name)}\s*\.\s*{re.escape(field_name)}\s*\)\s*"
                if re.search(pat_field, size):
                    linked_ext = True
                # 필드↔구조체 전체 불일치: size가 sizeof(base)
                pat_base = rf"\bsizeof\s*\(\s*{re.escape(base_name)}\s*\)\s*"
                if re.search(pat_base, size):
                    flags["call_size_is_sizeof_base_struct"] = 1

            if linked_ext:
                flags["call_len_linked_to_dst_extended"] = 1
                # 정합성 위해 기본 len_linked도 세움
                flags["call_flag_len_linked_to_dst"] = 1

            # sizeof_non_dst: sizeof가 있는데 dst 관련 토큰이 전혀 없을 때
            if "sizeof" in size:
                related = False
                if dst_name and re.search(
                    rf"\bsizeof\s*\(\s*\*?{re.escape(dst_name)}\b", size
                ):
                    related = True
                if shape == "field" and base_name and field_name:
                    if re.search(
                        rf"\bsizeof\s*\(\s*{re.escape(base_name)}\s*\.\s*{re.escape(field_name)}\s*\)",
                        size,
                    ):
                        related = True
                if not related:
                    flags["call_flag_sizeof_non_dst"] = 1

            # 요약 비트: 필드 dst인데 size가 필드와 연계되지 않거나(base 전체)면 1
            mismatch = 0
            if shape == "field":
                if flags["call_size_is_sizeof_base_struct"] == 1:
                    mismatch = 1
                elif "sizeof" in size and not (
                    flags["call_flag_len_linked_to_dst"] == 1
                    or flags["call_len_linked_to_dst_extended"] == 1
                ):
                    mismatch = 1
            if mismatch:
                flags["call_size_mismatch_field"] = 1

    return flags


def guards_from_condition(cond_code: str) -> Dict[str, Dict[str, Any]]:
    """
    조건 문자열에서 하한/상한 가드 증거 추출 (간단 휴리스틱)
    - x >= 0, x > 0 → lower=1
    - x <= K, x < K → upper=1, upper_const=norm(K)
    """
    res: Dict[str, Dict[str, Any]] = {}
    for m in re.finditer(
        r"\b([A-Za-z_]\w*)\s*>\s*=\s*0|\b([A-Za-z_]\w*)\s*>\s*0", cond_code or ""
    ):
        var = m.group(1) or m.group(2)
        if var:
            res.setdefault(var, {"lower": 0, "upper": 0, "upper_const": 0.0})
            res[var]["lower"] = 1
    for m in re.finditer(
        r"\b([A-Za-z_]\w*)\s*<\s*=\s*(\d+)|\b([A-Za-z_]\w*)\s*<\s*(\d+)",
        cond_code or "",
    ):
        var = m.group(1) or m.group(3)
        val = m.group(2) or m.group(4)
        if var and val:
            res.setdefault(var, {"lower": 0, "upper": 0, "upper_const": 0.0})
            res[var]["upper"] = 1
            res[var]["upper_const"] = norm_val(int(val))
    return res


class ASTExtractorV1_1:
    def __init__(self, ast_json: Dict[str, Any]):
        self.ast = ast_json
        # id -> AST node map for quick lookup
        self.idmap = {}

        def _idx(n):
            if isinstance(n, dict):
                nid = n.get("id")
                if isinstance(nid, int):
                    self.idmap[nid] = n
                for c in n.get("children") or []:
                    _idx(c)
            elif isinstance(n, list):
                for x in n:
                    _idx(x)

        _idx(self.ast)
        self.nodes: List[Dict[str, Any]] = []
        self.edges_pc: List[Tuple[int, int, int]] = []
        self.edges_sb: List[Tuple[int, int, int]] = []
        self.edges_guard: List[Dict[str, Any]] = []
        self.sid_counter = 1

        func_name = self.ast.get("name", "<func>")
        func_orig_id = (
            self.ast.get("id") if isinstance(self.ast.get("id"), int) else None
        )
        # FunctionEntry (sid=0): feat/debug 분리 + DFG 호환 키 유지
        self.nodes.append(
            {
                "sid": 0,
                # DFG 호환 메타 (DFGExtractor가 사용)
                "node_type_id": "FunctionEntry",
                "code": f"<entry:{func_name}>",
                "orig_id": func_orig_id,
                # 학습용
                "feat": {
                    "node_type_id": "FunctionEntry",
                    "in_loop": 0,
                    "is_loop": 0,
                    "ctx_guard_strength": 0,
                    "ctx_upper_bound_norm": 0.0,
                    "is_buffer_decl": 0,
                    "buffer_size_state": 0,
                    "buffer_size_norm": 0.0,
                    "call_sem_cat_id": 0,
                    "call_flag_danger_unbounded": 0,
                    "call_flag_len_linked_to_dst": 0,
                    "call_flag_sizeof_non_dst": 0,
                    "call_flag_has_varargs": 0,
                    # 추가
                    "call_dst_is_field": 0,
                    "call_size_kind": 0,
                    "call_len_linked_to_dst_extended": 0,
                    "call_size_is_sizeof_base_struct": 0,
                    "call_size_mismatch_field": 0,
                    "alloc_sizeof_state": 0,
                },
                # 디버그용
                "debug": {"code": f"<entry:{func_name}>"},
            }
        )

    def _make_node(
        self,
        node_type: str,
        code: str,
        in_loop: int,
        is_loop: int,
        guard_lower: int,
        guard_upper: int,
        upper_norm: float,
        name_hint: str = "",
        orig_id: Optional[int] = None,
        debug_extra: dict | None = None,
    ) -> int:
        """statement-level 노드 생성 + AST-GNN 입력 피처 주입 (feat/debug 분리)"""
        sid = self.sid_counter
        self.sid_counter += 1

        # 호출 의미 + 플래그 계산(코드 문자열 기반 휴리스틱)
        call_sem_cat_id = (
            call_sem_cat_id_from_name(name_hint)
            if name_hint
            else call_sem_cat_id_from_code(code)
        )
        call_flags = compute_call_flags(code, name_hint)

        # --- Non-call statement nodes: force semantic category & call flags to neutral ---
        if node_type not in {"StandardLibCall", "UserDefinedCall", "CallExpression"}:
            call_sem_cat_id = 0
            call_flags = {
                "call_flag_danger_unbounded": 0,
                "call_flag_len_linked_to_dst": 0,
                "call_flag_sizeof_non_dst": 0,
                "call_flag_has_varargs": 0,
                # 추가
                "call_dst_is_field": 0,
                "call_size_kind": 0,
                "call_len_linked_to_dst_extended": 0,
                "call_size_is_sizeof_base_struct": 0,
                "call_size_mismatch_field": 0,
                "alloc_sizeof_state": 0,
            }

        # 버퍼 선언 컨텍스트
        is_buf_decl = 1 if node_type == "ArrayDeclaration" else 0
        if is_buf_decl:
            buf_state, buf_norm = parse_array_size_state_and_norm(code)
        else:
            buf_state, buf_norm = (0, 0.0)

        # 노드 컨텍스트 가드 강도
        ctx_strength = (1 if guard_lower else 0) + (2 if guard_upper else 0)

        # --- 학습용 feat ---
        feat = {
            "node_type_id": node_type,
            "in_loop": in_loop,
            "is_loop": is_loop,
            "ctx_guard_strength": ctx_strength,
            "ctx_upper_bound_norm": (upper_norm if guard_upper else 0.0),
            "is_buffer_decl": is_buf_decl,
            "buffer_size_state": buf_state,
            "buffer_size_norm": buf_norm,
            "call_sem_cat_id": call_sem_cat_id,
            "call_flag_danger_unbounded": call_flags["call_flag_danger_unbounded"],
            "call_flag_len_linked_to_dst": call_flags["call_flag_len_linked_to_dst"],
            "call_flag_sizeof_non_dst": call_flags["call_flag_sizeof_non_dst"],
            "call_flag_has_varargs": call_flags["call_flag_has_varargs"],
            # NEW (AST-GNN 보강 피처)
            "call_dst_is_field": call_flags["call_dst_is_field"],
            "call_size_kind": call_flags["call_size_kind"],
            "call_len_linked_to_dst_extended": call_flags[
                "call_len_linked_to_dst_extended"
            ],
            "call_size_is_sizeof_base_struct": call_flags[
                "call_size_is_sizeof_base_struct"
            ],
            "call_size_mismatch_field": call_flags["call_size_mismatch_field"],
            "alloc_sizeof_state": call_flags["alloc_sizeof_state"],
        }

        # --- 디버그용 debug ---
        debug = {"code": (code or "").strip()}
        if debug_extra:
            try:
                debug.update(debug_extra)
            except Exception:
                pass

        # DFG 호환을 위한 상위 메타 키 유지: node_type_id / code / orig_id
        row = {
            "sid": sid,
            "node_type_id": node_type,
            "code": (code or "").strip(),
            "orig_id": orig_id,
            "feat": feat,
            "debug": debug,
        }
        self.nodes.append(row)
        return sid

    # ---- AST helpers for control-call postprocess ----
    def _find_first_call_node(self, node: dict) -> dict | None:
        if not isinstance(node, dict):
            return None
        nt = node.get("nodeType")
        if nt in {"StandardLibCall", "UserDefinedCall", "CallExpression"}:
            return node
        for ch in node.get("children") or []:
            if isinstance(ch, dict):
                f = self._find_first_call_node(ch)
                if f is not None:
                    return f
        return None

    def _get_call_args_from_ast(self, call_node: dict) -> list[dict]:
        if not isinstance(call_node, dict):
            return []
        kids = call_node.get("children") or []
        for ch in kids:
            if isinstance(ch, dict) and ch.get("nodeType") == "ParameterList":
                return [c for c in (ch.get("children") or []) if isinstance(c, dict)]
        return []

    def _normalize_expr(self, s: str) -> str:
        import re as _re

        if not isinstance(s, str):
            return ""
        s2 = _re.sub(r"\s+", "", s or "")
        while s2.startswith("(") and s2.endswith(")"):
            depth = 0
            ok = True
            for i, ch in enumerate(s2):
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth == 0 and i != len(s2) - 1:
                        ok = False
                        break
            if ok:
                s2 = s2[1:-1]
            else:
                break
        return s2

    def _find_array_length_for_var(self, var_name: str) -> str | None:
        import re as _re

        if not var_name:
            return None
        stack = [self.ast]
        while stack:
            n = stack.pop()
            if not isinstance(n, dict):
                continue
            if n.get("nodeType") == "ArrayDeclaration" and n.get("name") == var_name:
                length = n.get("length")
                if isinstance(length, str) and length:
                    return length
                code = n.get("code", "") or ""
                m = _re.search(r"\[\s*(.*?)\s*\]", code)
                if m:
                    return m.group(1)
            stack.extend([c for c in (n.get("children") or []) if isinstance(c, dict)])
        return None

    def _process_block(
        self,
        block_node: Dict[str, Any],
        parent_sid: int,
        active_guards: Dict[str, Dict[str, Any]],
        in_loop: int,
    ) -> Tuple[Optional[int], Optional[int]]:
        """
        블록(CompoundStatement) 내부를 순회하며 statement-level 노드를 생성
        - edges_ast_pc: parent→child
        - edges_ast_sb: statement order
        - edges_ast_guard: (guard_stmt → first_stmt_in_block, {guard_kind, guard_branch})
        """
        sb_prev: Optional[int] = None
        first_sid: Optional[int] = None

        for ch in block_node.get("children") or []:
            t = ch.get("nodeType")

            # 중첩 블록
            if t == "CompoundStatement":
                child_first, child_last = self._process_block(
                    ch, parent_sid, dict(active_guards), in_loop
                )
                if child_first is not None:
                    if sb_prev is not None:
                        self.edges_sb.append((sb_prev, child_first, 1))
                    if first_sid is None:
                        first_sid = child_first
                    sb_prev = child_last
                continue

            # IfStatement
            if t == "IfStatement":
                cond_children = ch.get("children") or []
                cond_node = (
                    cond_children[0]
                    if cond_children and isinstance(cond_children[0], dict)
                    else None
                )
                cond_code = (
                    cond_node.get("code", "") if cond_node else ch.get("code", "")
                )
                sid_if = self._make_node(
                    "IfStatement",
                    cond_code,
                    in_loop,
                    0,
                    0,
                    0,
                    0.0,
                    orig_id=ch.get("id"),
                )
                self.edges_pc.append((parent_sid, sid_if, 0))
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_if, 1))
                if first_sid is None:
                    first_sid = sid_if
                sb_prev = sid_if

                kids = ch.get("children", []) or []
                cond = kids[0] if len(kids) >= 1 else None
                then_block = kids[1] if len(kids) >= 2 else None
                else_block = kids[2] if len(kids) >= 3 else None

                cond_code = cond.get("code", "") if isinstance(cond, dict) else ""
                cond_guards = guards_from_condition(cond_code)

                # THEN
                if (
                    isinstance(then_block, dict)
                    and then_block.get("nodeType") == "CompoundStatement"
                ):
                    pushed = dict(active_guards)
                    for v, g in cond_guards.items():
                        pushed[v] = {
                            "lower": g.get("lower", 0),
                            "upper": g.get("upper", 0),
                            "upper_const": g.get("upper_const", 0.0),
                        }
                    then_first, _then_last = self._process_block(
                        then_block, sid_if, pushed, in_loop
                    )
                    if then_first is not None:
                        self.edges_guard.append(
                            {
                                "src": sid_if,
                                "dst": then_first,
                                "guard_kind": 1,
                                "guard_branch": 0,
                            }
                        )
                # ELSE
                if (
                    isinstance(else_block, dict)
                    and else_block.get("nodeType") == "CompoundStatement"
                ):
                    else_first, _else_last = self._process_block(
                        else_block, sid_if, dict(active_guards), in_loop
                    )
                    if else_first is not None:
                        self.edges_guard.append(
                            {
                                "src": sid_if,
                                "dst": else_first,
                                "guard_kind": 1,
                                "guard_branch": 1,
                            }
                        )
                continue

            # ForStatement
            if t == "ForStatement":
                sid_for = self._make_node(
                    "ForStatement",
                    ch.get("code", ""),
                    in_loop,
                    1,
                    0,
                    0,
                    0.0,
                    orig_id=ch.get("id"),
                )
                self.edges_pc.append((parent_sid, sid_for, 0))
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_for, 1))
                if first_sid is None:
                    first_sid = sid_for
                sb_prev = sid_for

                kids = ch.get("children", []) or []
                cond = kids[1] if len(kids) > 1 else None
                cond_code = cond.get("code", "") if isinstance(cond, dict) else ""
                lguards = guards_from_condition(cond_code)

                pushed = dict(active_guards)
                for v, g in lguards.items():
                    pushed[v] = {
                        "lower": g.get("lower", 0),
                        "upper": g.get("upper", 0),
                        "upper_const": g.get("upper_const", 0.0),
                    }

                body = kids[3] if len(kids) > 3 else None
                if (
                    isinstance(body, dict)
                    and body.get("nodeType") == "CompoundStatement"
                ):
                    body_first, _body_last = self._process_block(
                        body, sid_for, pushed, 1
                    )
                    if body_first is not None:
                        self.edges_guard.append(
                            {
                                "src": sid_for,
                                "dst": body_first,
                                "guard_kind": 2,
                                "guard_branch": 2,
                            }
                        )
                continue

            # WhileStatement
            if t == "WhileStatement":
                sid_while = self._make_node(
                    "WhileStatement",
                    ch.get("code", ""),
                    in_loop,
                    1,
                    0,
                    0,
                    0.0,
                    orig_id=ch.get("id"),
                )
                self.edges_pc.append((parent_sid, sid_while, 0))
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_while, 1))
                if first_sid is None:
                    first_sid = sid_while
                sb_prev = sid_while

                kids = ch.get("children", []) or []
                cond = kids[0] if len(kids) > 0 else None
                cond_code = cond.get("code", "") if isinstance(cond, dict) else ""
                lguards = guards_from_condition(cond_code)

                pushed = dict(active_guards)
                for v, g in lguards.items():
                    pushed[v] = {
                        "lower": g.get("lower", 0),
                        "upper": g.get("upper", 0),
                        "upper_const": g.get("upper_const", 0.0),
                    }

                body = kids[1] if len(kids) > 1 else None
                if (
                    isinstance(body, dict)
                    and body.get("nodeType") == "CompoundStatement"
                ):
                    body_first, _body_last = self._process_block(
                        body, sid_while, pushed, 1
                    )
                    if body_first is not None:
                        self.edges_guard.append(
                            {
                                "src": sid_while,
                                "dst": body_first,
                                "guard_kind": 2,
                                "guard_branch": 2,
                            }
                        )
                continue

            # SwitchStatement (간단: 노드만 생성하고 자식 블록은 그대로 순회)
            if t == "SwitchStatement":
                sid_sw = self._make_node(
                    "SwitchStatement",
                    ch.get("code", ""),
                    in_loop,
                    0,
                    0,
                    0,
                    0.0,
                    orig_id=ch.get("id"),
                )
                self.edges_pc.append((parent_sid, sid_sw, 0))
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_sw, 1))
                if first_sid is None:
                    first_sid = sid_sw
                sb_prev = sid_sw
                # body 추출
                kids = ch.get("children", []) or []
                body = kids[1] if len(kids) > 1 else None
                if (
                    isinstance(body, dict)
                    and body.get("nodeType") == "CompoundStatement"
                ):
                    body_first, _body_last = self._process_block(
                        body, sid_sw, dict(active_guards), in_loop
                    )
                continue

            # 표준/사용자 정의 호출 노드 직접 처리
            if t in {"StandardLibCall", "UserDefinedCall"}:
                call_name = ch.get("name") or ""
                # node_type은 그대로 사용 (StandardLibCall/UserDefinedCall)
                code = ch.get("code", "")
                any_lower = (
                    1
                    if any(g.get("lower", 0) == 1 for g in active_guards.values())
                    else 0
                )
                any_upper = (
                    1
                    if any(g.get("upper", 0) == 1 for g in active_guards.values())
                    else 0
                )
                upper_norm = max(
                    (g.get("upper_const", 0.0) for g in active_guards.values()),
                    default=0.0,
                )

                sid_cur = self._make_node(
                    t,
                    code,
                    in_loop,
                    0,
                    any_lower,
                    any_upper,
                    upper_norm,
                    name_hint=call_name,
                    orig_id=ch.get("id"),
                )

                self.edges_pc.append((parent_sid, sid_cur, 0))
                if sb_prev is not None:
                    self.edges_sb.append((sb_prev, sid_cur, 1))
                if first_sid is None:
                    first_sid = sid_cur
                sb_prev = sid_cur
                continue

            # statement-level 노드만 유지
            if t not in KEEP_TYPES:
                continue

            code = ch.get("code", "")
            any_lower = (
                1 if any(g.get("lower", 0) == 1 for g in active_guards.values()) else 0
            )
            any_upper = (
                1 if any(g.get("upper", 0) == 1 for g in active_guards.values()) else 0
            )
            upper_norm = max(
                (g.get("upper_const", 0.0) for g in active_guards.values()), default=0.0
            )

            debug_extra = None
            if t == "PointerDeclaration":
                debug_extra = {
                    "decl_name": ch.get("name"),
                    "pointingType": ch.get("pointingType"),
                    "ptr_level": ch.get("level"),
                    "storage": ch.get("storage"),
                }
            # sid_cur = self._make_node(t, code, in_loop, 0, any_lower, any_upper, upper_norm,
            #                          name_hint=ch.get("name","") or ch.get("spelling","") or "",
            #                          orig_id=ch.get("id"),
            #                          debug_extra=debug_extra)

            name_hint = ch.get("name", "") or ch.get("spelling", "") or ""
            sid_cur = self._make_node(
                t,
                code,
                in_loop,
                0,
                any_lower,
                any_upper,
                upper_norm,
                name_hint=name_hint,
                orig_id=ch.get("id"),
                debug_extra=debug_extra,
            )

            # AssignmentExpression RHS에 메모리 할당 호출이 있으면 AST-GNN 피처 보정 ----
            # target 예: data = (int*)ALLOCA(10), data = malloc(n), data = calloc(k, sizeof(int))
            if t == "AssignmentExpression":
                # 1) 하위 트리에서 첫 CallExpression/StandardLibCall/UserDefinedCall을 찾음
                def _find_first_call(n: Dict[str, Any]) -> Optional[Dict[str, Any]]:
                    if not isinstance(n, dict):
                        return None
                    nt = n.get("nodeType")
                    if nt in {"CallExpression", "StandardLibCall", "UserDefinedCall"}:
                        return n
                    for c in n.get("children") or []:
                        r = _find_first_call(c)
                        if r is not None:
                            return r
                    return None

                # LHS, RHS 분리 후 RHS 쪽만 검사 (LHS에 다른 노이즈가 있어도 안전)
                _kids = ch.get("children") or []
                _rhs = _kids[1] if len(_kids) >= 2 else None
                rhs_wrapped = _rhs
                rhs_core = _unwrap_cast_paren(_rhs) if isinstance(_rhs, dict) else _rhs
                calln = _find_first_call(rhs_core if isinstance(rhs_core, dict) else ch)

                if calln:
                    fname = calln.get("name") or ""
                    if _is_mem_alloc_name(fname):
                        # 직전에 append된 현재 노드의 feat을 보정
                        feat = self.nodes[-1]["feat"]
                        feat["call_sem_cat_id"] = 1  # mem_alloc
                        # 2) sizeof 사용 여부 판단
                        has_sizeof = _node_contains_sizeof(calln)
                        feat["alloc_sizeof_state"] = 2 if has_sizeof else 1
                        # 디버그 보조
                        dbg = self.nodes[-1].setdefault("debug", {})
                        dbg["alloc_func"] = fname
                        dbg["alloc_has_sizeof"] = int(has_sizeof)
                        # Cast/Paren 래핑 여부 기록 (분석 편의)
                        if isinstance(rhs_wrapped, dict):
                            nt = rhs_wrapped.get("nodeType")
                            if nt in {
                                "CastExpression",
                                "CStyleCastExpr",
                                "ParenExpression",
                                "ParenExpr",
                            }:
                                dbg["alloc_rhs_wrapped_by_cast"] = 1
                                if nt == "CastExpression":
                                    dbg["alloc_cast_target_type"] = rhs_wrapped.get(
                                        "targetType", ""
                                    )
                            else:
                                dbg["alloc_rhs_wrapped_by_cast"] = 0

            self.edges_pc.append((parent_sid, sid_cur, 0))
            if sb_prev is not None:
                self.edges_sb.append((sb_prev, sid_cur, 1))
            if first_sid is None:
                first_sid = sid_cur
            sb_prev = sid_cur

        return first_sid, sb_prev

    def _postprocess_control_calls(self):
        """For control statements, set call_sem_cat_id/flags based on calls in the condition (AST name-based)."""
        for n in self.nodes:
            t = n.get("node_type_id")
            if t not in {"IfStatement", "WhileStatement", "ForStatement"}:
                continue
            orig = n.get("orig_id")
            ast_node = self.idmap.get(orig)
            if not isinstance(ast_node, dict):
                continue
            # condition is usually the first child
            cond_children = ast_node.get("children") or []
            cond = (
                cond_children[0]
                if cond_children and isinstance(cond_children[0], dict)
                else None
            )
            call_node = self._find_first_call_node(cond) if cond else None
            if not isinstance(call_node, dict):
                continue
            fname = call_node.get("name") or ""
            # call sem by name only
            sem = call_sem_cat_id_from_name(fname)
            # flags by parsing only this call's code
            flags = compute_call_flags(call_node.get("code", ""), fname)
            # refine len_linked_to_dst by comparing to declared array length
            # (same as earlier refinement in other patch)
            args = self._get_call_args_from_ast(call_node)
            dst = size = None
            low = (fname or "").lower()
            if low in {"fgets"} and len(args) >= 2:
                dst, size = args[0], args[1]
            elif low in {"memcpy", "memmove", "strncpy"} and len(args) >= 3:
                dst, size = args[0], args[2]
            elif low in {"snprintf", "vsnprintf"} and len(args) >= 2:
                dst, size = args[0], args[1]
            elif low in {"read", "recv"} and len(args) >= 3:
                dst, size = args[1], args[2]
            if isinstance(dst, dict) and isinstance(size, dict):
                import re as _re

                dst_code = dst.get("code", "") or ""
                m = _re.match(r"\b([A-Za-z_]\w*)", dst_code)
                dst_name = m.group(1) if m else None
                decl_len = (
                    self._find_array_length_for_var(dst_name) if dst_name else None
                )
                if decl_len and self._normalize_expr(
                    size.get("code", "")
                ) == self._normalize_expr(decl_len):
                    flags["call_flag_len_linked_to_dst"] = 1
                    flags["call_flag_sizeof_non_dst"] = 0
            # Write back to node feat
            nfeat = n.get("feat", {})
            nfeat["call_sem_cat_id"] = sem
            # carry over existing zeros, then update with computed flags
            for k in [
                "call_flag_danger_unbounded",
                "call_flag_len_linked_to_dst",
                "call_flag_sizeof_non_dst",
                "call_flag_has_varargs",
                "alloc_sizeof_state",
            ]:
                nfeat[k] = nfeat.get(k, 0)
            nfeat.update(
                {
                    "call_flag_danger_unbounded": flags.get(
                        "call_flag_danger_unbounded", 0
                    ),
                    "call_flag_len_linked_to_dst": flags.get(
                        "call_flag_len_linked_to_dst", 0
                    ),
                    "call_flag_sizeof_non_dst": flags.get(
                        "call_flag_sizeof_non_dst", 0
                    ),
                    "call_flag_has_varargs": flags.get("call_flag_has_varargs", 0),
                    "alloc_sizeof_state": flags.get("alloc_sizeof_state", 0),
                }
            )
            n["feat"] = nfeat

    def run(self) -> Dict[str, Any]:
        """함수 AST에서 CompoundStatement를 찾아 평탄화 수행"""
        func_body = None
        for c in self.ast.get("children") or []:
            if isinstance(c, dict) and c.get("nodeType") == "CompoundStatement":
                func_body = c
                break
        if func_body is not None:
            _first, _last = self._process_block(func_body, 0, {}, 0)
            # postprocess control nodes for call semantics
        self._postprocess_control_calls()
        return {
            "nodes": self.nodes,  # 각 노드: {sid, node_type_id, code, orig_id, feat{...}, debug{...}}
            "edges_ast_pc": self.edges_pc,  # (변경 없음) [(parent_sid, child_sid, 0)]
            "edges_ast_sb": self.edges_sb,  # (변경 없음) [(prev_sid, next_sid, 1)]
            "edges_ast_guard": self.edges_guard,  # (변경 없음) [{src, dst, guard_kind, guard_branch}]
        }
