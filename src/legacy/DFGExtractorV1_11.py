"""
AST→DFG 평탄화 (V1.9)
- 평탄화 노드에 포함된 원본 AST id(`orig_id`)를 이용해 **원본 AST 노드(dict)를 역참조**하여 구조 기반 파싱 수행
- `orig_id`가 없을 땐 `id` 필드도 시도, 그래도 없으면 안전한 **코드 기반 폴백 파서** 사용
- AssignmentExpression: **AST children로 LHS/RHS 분리**, LHS 인덱싱(쓰기)→ 비상수 인덱스 시 sink, RHS 인덱싱(읽기)도 buffer_access=1
- ArrayDeclaration: **sizeof(...) 내부 식별자 제외**, VLA면 size USE 생성 (flow_id=size)
- Control 노드(If/For/While/Switch): **var_name 비움**, 조건식의 인자만 USE(함수명/sizeof 내부 제외) + def-use edge 생성
- Parameter: 함수 진입 시 DEF로 초기화(last_def[param]=entry_sid)
- 위험 호출 인자 USE와 쓰기효과 DEF 반영 (memcpy/gets/fgets/scanf/recv/read/getline/strcpy/strcat/snprintf/sprintf)
- Guard evidence: edges_ast_guard 기반으로 dst별 {var: lower/upper/upper_const/kind}


입력 가정:
- ast_result: {
"nodes": [ {"sid":int, "node_type_id":str, "code":str, "orig_id":int?}, ... ],
"edges_ast_guard": [ {"src":sid, "dst":sid, "guard_kind":int}, ... ]
}
- ast_json: 원본 AST(JSON) — 각 노드에 `id`, `nodeType`, `name`, `children` 등이 포함 (Clang-like)
"""

import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Set, Tuple

KEYWORDS = {
    "if",
    "for",
    "while",
    "switch",
    "case",
    "return",
    "int",
    "char",
    "void",
    "NULL",
    "sizeof",
    "stdin",
    "else",
}
FUNCTION_META = {"FunctionEntry", "FunctionDeclaration", "FunctionDefinition"}
CONTROL_NODES = {"IfStatement", "ForStatement", "WhileStatement", "SwitchStatement"}

FLOW_ID = {"value": 1, "index": 2, "size": 3, "base": 4}


# ------------------------------
# DFG Extractor V1.9
# ------------------------------
class DFGExtractorV1_11:
    def __init__(
        self,
        ast_json: Dict[str, Any],
        ast_result: Dict[str, Any],
        sink_mode: str = "k1",
    ):
        self.ast_json = ast_json
        self.ast_nodes = ast_result.get("nodes", [])
        self.ast_guard = ast_result.get("edges_ast_guard", [])
        # map: sid -> flat AST row (to fetch orig_id etc.)
        self.sid2flat: Dict[int, Dict[str, Any]] = {}
        for _row in self.ast_nodes:
            try:
                _sid = int(_row.get("sid"))
            except Exception:
                continue
            self.sid2flat[_sid] = _row
        self.sink_mode = sink_mode

        # 원본 AST 인덱스 (id→node)
        self.id2orig: Dict[int, Dict[str, Any]] = self._index_ast_by_id(self.ast_json)

        # 파라미터 목록
        self.param_names: List[str] = self._collect_param_names(self.ast_json)

        # 결과 컨테이너
        self.nodes: List[Dict[str, Any]] = []  # DFG 노드(feature)
        self.edges_defuse: List[Tuple[int, int, Dict[str, Any]]] = []

        # DFG 노드 초기화 (sid 공유). 디버그 필드는 run()에서 최종 동기화
        for n in self.ast_nodes:
            sid = int(n.get("sid"))
            code = n.get("code") or ""
            node_type = n.get("node_type_id") or ""

            self.nodes.append(
                {
                    "sid": sid,
                    "code": code,
                    "node_type_id": node_type,
                    # 아래 필드들은 run()에서 실제 DEF/USE/degree를 반영해 덮어씀
                }
            )

        self.edges_defuse_raw: List[Tuple[int, int, Dict[str, Any]]] = (
            []
        )  # 임시(변환 전)

    # ------------------------------
    # Public: build edges + finalize node features
    # ------------------------------
    def run(self) -> Dict[str, Any]:
        import re
        from collections import defaultdict

        # 가드 정보(변수별 하한/상한 증거) 사전 구축
        guard_map = self._build_guard_map()

        # 마지막 DEF 위치, 중복 에지 방지 키
        last_def: Dict[str, int] = {}
        seen_edges: Set[Tuple[int, int, str, int]] = set()  # (src,dst,var,flow_id)

        # 디버그/특징 동기화 버킷
        use_vars_by_sid: Dict[int, Set[str]] = defaultdict(set)
        def_vars_by_sid: Dict[int, Set[str]] = defaultdict(set)
        iba_by_sid: Dict[int, int] = defaultdict(int)  # is_buffer_access
        sink_assign_by_sid: Dict[int, int] = defaultdict(int)  # is_sink_assign

        # 노드별 특징/디버그 컨테이너
        node_feat: Dict[int, Dict[str, Any]] = {}
        node_debug: Dict[int, Dict[str, Any]] = {}

        # 호출 기반 sink 구분 세트
        UNBOUNDED = {"gets", "strcpy", "strcat", "sprintf", "vsprintf"}
        BOUNDED = {
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

        # 파라미터 → 진입 DEF 처리
        for p in self.param_names:
            if p and p != "<empty>":
                last_def[p] = 0
                def_vars_by_sid[0].add(p)

        # self.edges_defuse: 원래 코드에서 사용하던 RAW 저장소 유지
        # (최종 반환 시 feat/debug로 변환)
        self.edges_defuse = []

        def ensure_feat(sid: int, node_type_id: str):
            if sid not in node_feat:
                node_feat[sid] = {
                    "node_type_id": node_type_id,
                    "in_degree_dfg": 0,
                    "out_degree_dfg": 0,
                    # counts
                    "def_count": 0,
                    "use_count": 0,
                    # buffer/sink
                    "is_buffer_access": 0,
                    "is_sink_assign": 0,
                    "is_sink_call_unbounded": 0,
                    "is_sink_call_bounded": 0,
                    "call_dst_indexed": 0,
                    "call_len_linked_to_dst": 0,
                    "call_size_nonconst": 0,
                    "call_danger_unbounded": 0,
                }
            if sid not in node_debug:
                node_debug[sid] = {"code": "", "def_vars": [], "use_vars": []}

        def _pick_dst_size_args(base: str, arg_nodes: List[Dict[str, Any]]):
            dst = None
            size = None
            if base == "fgets":
                dst = arg_nodes[0] if len(arg_nodes) > 0 else None
                size = arg_nodes[1] if len(arg_nodes) > 1 else None
            elif base == "gets":
                dst = arg_nodes[0] if len(arg_nodes) > 0 else None
            elif base in {"memcpy", "memmove", "strncpy"}:
                dst = arg_nodes[0] if len(arg_nodes) > 0 else None
                size = arg_nodes[2] if len(arg_nodes) > 2 else None
            elif base in {"snprintf", "vsnprintf"}:
                dst = arg_nodes[0] if len(arg_nodes) > 0 else None
                size = arg_nodes[1] if len(arg_nodes) > 1 else None
            elif base in {"strcpy", "strcat", "sprintf", "vsprintf"}:
                dst = arg_nodes[0] if len(arg_nodes) > 0 else None
            elif base in {"read", "recv"}:
                dst = arg_nodes[1] if len(arg_nodes) > 1 else None
                size = arg_nodes[2] if len(arg_nodes) > 2 else None
            elif base == "getline":
                dst = arg_nodes[0] if len(arg_nodes) > 0 else None  # lineptr
                size = arg_nodes[1] if len(arg_nodes) > 1 else None  # n(pointer)
            return dst, size

        def _add_use_edge(var: str, role: str, dst_sid: int):
            if not var or var in KEYWORDS:
                return
            if var not in last_def:
                return
            src = last_def[var]
            fid = FLOW_ID.get(role, FLOW_ID["value"])
            key = (src, dst_sid, var, fid)
            if key in seen_edges:
                return
            seen_edges.add(key)
            gi = guard_map.get(dst_sid, {}).get(var, {})
            self.edges_defuse.append(
                (
                    src,
                    dst_sid,
                    {
                        "var_key": f"{var}@{src}",  # 디버그용 안정 식별자
                        "flow_id": fid,
                        "guard_kind": gi.get("kind", 0),
                        "has_lower_guard": gi.get("lower", 0),
                        "has_upper_guard": gi.get("upper", 0),
                        "upper_guard_norm": gi.get("upper_const", 0.0),
                    },
                )
            )
            use_vars_by_sid[dst_sid].add(var)

        # 메인 루프: AST 노드 순회
        for row in self.nodes:
            sid = row["sid"]
            code = row["code"]
            node_type = row["node_type_id"]

            ensure_feat(sid, node_type)
            node_debug[sid]["code"] = code

            orig = self._orig_for_stmt(self._find_ast_row_by_sid(sid))

            # (0) 문장 내부 호출 처리 (컨트롤 노드는 전체 subtree 제외)
            exclude_vars_stmt: Set[str] = set()
            used_by_call_stmt: Set[str] = set()
            if isinstance(orig, dict) and (node_type not in CONTROL_NODES):
                for fname, arg_nodes in self._iter_calls_ast(orig):
                    base = (fname or "").lower()

                    # 인자 USE (역할 매핑)
                    for v, role in self._call_arg_uses_ast(fname, arg_nodes):
                        used_by_call_stmt.add(v)
                        _add_use_edge(v, role, sid)

                    # 쓰기효과 DEF (dst 등)
                    for v in self._call_write_effects_ast(fname, arg_nodes):
                        if v and v not in KEYWORDS:
                            last_def[v] = sid
                            def_vars_by_sid[sid].add(v)
                            exclude_vars_stmt.add(v)  # dst 인자는 토큰 USE에서 제외

                    # ---- 호출 기반 sink/증거 비트 ----
                    dst_arg, size_arg = _pick_dst_size_args(base, arg_nodes)

                    # dst 인덱싱 여부
                    dst_indexed = (
                        1 if self._has_indexing(dst_arg, skip_sizeof=True) else 0
                    )

                    # len-linked / size nonconst
                    size_txt = (
                        (size_arg.get("code") or "")
                        if isinstance(size_arg, dict)
                        else ""
                    )
                    dst_names = (
                        set(self._idents_from_ast_node(dst_arg))
                        if isinstance(dst_arg, dict)
                        else set()
                    )
                    linked = 0
                    if size_txt and dst_names:
                        linked = (
                            1
                            if any(("sizeof(" + dn) in size_txt for dn in dst_names)
                            else 0
                        )
                    size_txt_wo_sizeof = re.sub(r"\bsizeof\s*\([^)]*\)", "", size_txt)
                    nonconst = (
                        1
                        if (size_txt and re.search(r"[A-Za-z_]\w*", size_txt_wo_sizeof))
                        else 0
                    )

                    if base in UNBOUNDED:
                        node_feat[sid]["is_sink_call_unbounded"] = 1
                        node_feat[sid]["call_danger_unbounded"] = 1
                        node_feat[sid]["call_dst_indexed"] = max(
                            node_feat[sid]["call_dst_indexed"], dst_indexed
                        )
                    elif base in BOUNDED:
                        node_feat[sid]["is_sink_call_bounded"] = 1
                        node_feat[sid]["call_dst_indexed"] = max(
                            node_feat[sid]["call_dst_indexed"], dst_indexed
                        )
                        node_feat[sid]["call_len_linked_to_dst"] = max(
                            node_feat[sid]["call_len_linked_to_dst"], linked
                        )
                        node_feat[sid]["call_size_nonconst"] = max(
                            node_feat[sid]["call_size_nonconst"], nonconst
                        )

            # (1) Control nodes: 조건 서브트리만 처리하고 종료
            if node_type in CONTROL_NODES and isinstance(orig, dict):
                cond_node = self._get_condition_node(node_type, orig)
                if cond_node is not None:
                    exclude_vars_cond: Set[str] = set()
                    used_by_call_cond: Set[str] = set()
                    # (a) 조건 내부 호출 먼저 처리
                    base = ""
                    for fname, arg_nodes in self._iter_calls_ast(cond_node):
                        base = fname.lower()

                        # 인자 USE
                        for v, role in self._call_arg_uses_ast(fname, arg_nodes):
                            used_by_call_cond.add(v)
                            _add_use_edge(v, role, sid)

                        # 쓰기효과 DEF
                        for v in self._call_write_effects_ast(fname, arg_nodes):
                            if v and v not in KEYWORDS:
                                last_def[v] = sid
                                def_vars_by_sid[sid].add(v)
                                exclude_vars_cond.add(v)

                    # 조건식에서도 호출 기반 sink/증거 비트 설정
                    dst_arg, size_arg = _pick_dst_size_args(base, arg_nodes)
                    dst_indexed = (
                        1 if self._has_indexing(dst_arg, skip_sizeof=True) else 0
                    )

                    size_txt = (
                        (size_arg.get("code") or "")
                        if isinstance(size_arg, dict)
                        else ""
                    )
                    dst_names = (
                        set(self._idents_from_ast_node(dst_arg))
                        if isinstance(dst_arg, dict)
                        else set()
                    )
                    linked = 0
                    if size_txt and dst_names:
                        linked = (
                            1
                            if any(("sizeof(" + dn) in size_txt for dn in dst_names)
                            else 0
                        )
                    size_txt_wo_sizeof = re.sub(r"\bsizeof\s*\([^)]*\)", "", size_txt)
                    nonconst = (
                        1
                        if (size_txt and re.search(r"[A-Za-z_]\w*", size_txt_wo_sizeof))
                        else 0
                    )

                    if base in UNBOUNDED:
                        node_feat[sid]["is_sink_call_unbounded"] = 1
                        node_feat[sid]["call_danger_unbounded"] = 1
                        node_feat[sid]["call_dst_indexed"] = max(
                            node_feat[sid]["call_dst_indexed"], dst_indexed
                        )
                    elif base in BOUNDED:
                        node_feat[sid]["is_sink_call_bounded"] = 1
                        node_feat[sid]["call_dst_indexed"] = max(
                            node_feat[sid]["call_dst_indexed"], dst_indexed
                        )
                        node_feat[sid]["call_len_linked_to_dst"] = max(
                            node_feat[sid]["call_len_linked_to_dst"], linked
                        )
                        node_feat[sid]["call_size_nonconst"] = max(
                            node_feat[sid]["call_size_nonconst"], nonconst
                        )

                    # (b) 나머지 식별자 value USE
                    for t in self._idents_from_ast_node(
                        cond_node, skip_sizeof=True, skip_callee=True
                    ):
                        if t in exclude_vars_cond or t in used_by_call_cond:
                            continue
                        _add_use_edge(t, "value", sid)
                # 컨트롤 노드는 공통 처리 스킵(본문은 해당 문장들에서 처리)
                continue

            # (2) Decl
            if node_type in {
                "VariableDeclaration",
                "ParameterDeclaration",
            } and isinstance(orig, dict):
                nm = orig.get("name")
                if isinstance(nm, str) and nm and nm not in KEYWORDS:
                    last_def[nm] = sid
                    def_vars_by_sid[sid].add(nm)
                continue

            # (3) Assignment
            if node_type == "AssignmentExpression" and isinstance(orig, dict):
                def_vars, uses, iba, sink = self._assignment_by_ast(orig, sid)
                # 호출 기반 토큰과 중복 방지
                uses = [
                    (v, r)
                    for (v, r) in uses
                    if v not in exclude_vars_stmt and v not in used_by_call_stmt
                ]
                for v, role in uses:
                    _add_use_edge(v, role, sid)
                for dv in def_vars:
                    if dv and dv not in KEYWORDS:
                        last_def[dv] = sid
                        def_vars_by_sid[sid].add(dv)
                if iba:
                    iba_by_sid[sid] = 1
                if sink:
                    sink_assign_by_sid[sid] = 1
                continue

            # (4) ArrayDecl / ArraySizeAllocation
            if node_type in {"ArrayDeclaration", "ArraySizeAllocation"} and isinstance(
                orig, dict
            ):
                def_vars, uses = self._array_decl_by_ast(orig)
                for v, role in uses:
                    _add_use_edge(v, role, sid)
                for dv in def_vars:
                    if dv and dv not in KEYWORDS:
                        last_def[dv] = sid
                        def_vars_by_sid[sid].add(dv)
                continue

            # (5) 기타 문장: value USE (callee/sizeof 제외)
            if isinstance(orig, dict):
                for t in self._idents_from_ast_node(
                    orig, skip_sizeof=True, skip_callee=True
                ):
                    if t in exclude_vars_stmt or t in used_by_call_stmt:
                        continue
                    _add_use_edge(t, "value", sid)

        # 차수 집계
        deg_in = {n["sid"]: 0 for n in self.nodes}
        deg_out = {n["sid"]: 0 for n in self.nodes}
        for s, d, _ in self.edges_defuse:
            if s in deg_out:
                deg_out[s] += 1
            if d in deg_in:
                deg_in[d] += 1

        # 최종 노드(feat/debug) 동기화
        out_nodes: List[Dict[str, Any]] = []
        for meta in self.nodes:
            sid = meta["sid"]
            code = meta["code"]
            node_type = meta["node_type_id"]

            ensure_feat(sid, node_type)

            ulist = sorted(
                [x for x in use_vars_by_sid.get(sid, set()) if x and x != "<empty>"]
            )
            dlist = sorted(
                [x for x in def_vars_by_sid.get(sid, set()) if x and x != "<empty>"]
            )

            feat = node_feat[sid]
            feat["in_degree_dfg"] = deg_in.get(sid, 0)
            feat["out_degree_dfg"] = deg_out.get(sid, 0)
            feat["def_count"] = len(dlist)
            feat["use_count"] = len(ulist)
            feat["is_buffer_access"] = 1 if iba_by_sid.get(sid, 0) else 0
            feat["is_sink_assign"] = 1 if sink_assign_by_sid.get(sid, 0) else 0

            dbg = node_debug[sid]
            dbg["code"] = code
            dbg["def_vars"] = dlist
            dbg["use_vars"] = ulist

            out_nodes.append({"sid": sid, "feat": feat, "debug": dbg})

        # 최종 에지: feat/debug 분리 변환
        out_edges: List[List[Any]] = []
        for s, d, attr in self.edges_defuse:
            out_edges.append(
                [
                    s,
                    d,
                    {
                        "feat": {
                            "flow_id": attr.get("flow_id", 1),
                            "guard_kind": attr.get("guard_kind", 0),
                            "has_lower_guard": attr.get("has_lower_guard", 0),
                            "has_upper_guard": attr.get("has_upper_guard", 0),
                            "upper_guard_norm": attr.get("upper_guard_norm", 0.0),
                        },
                        "debug": {"var_key": attr.get("var_key", "")},
                    },
                ]
            )

        return {"nodes": out_nodes, "edges_dfg": out_edges}

    # ------------------------------
    # AST helpers / schema-based visitors
    # ------------------------------
    def _find_ast_row_by_sid(self, sid: int) -> Dict[str, Any] | None:
        """Return flattened AST row by sid (has orig_id/id/code/node_type_id)."""
        try:
            s = int(sid)
        except Exception:
            return None
        return self.sid2flat.get(s)

    def _orig_for_stmt(self, flat_row: Dict[str, Any] | None) -> Dict[str, Any] | None:
        if not isinstance(flat_row, dict):
            return None
        orig_id = (
            flat_row.get("orig_id")
            if isinstance(flat_row.get("orig_id"), int)
            else None
        )
        if orig_id is None:
            # 일부 파이프라인은 평탄화 row에도 id를 보존할 수 있음
            alt = flat_row.get("id")
            orig_id = alt if isinstance(alt, int) else None
        return self.id2orig.get(orig_id)

    def _index_ast_by_id(self, node: Any) -> Dict[int, Dict[str, Any]]:
        out: Dict[int, Dict[str, Any]] = {}

        def walk(n: Any):
            if isinstance(n, dict):
                nid = n.get("id")
                if isinstance(nid, int):
                    out[nid] = n
                for c in n.get("children", []) or []:
                    walk(c)
            elif isinstance(n, list):
                for c in n:
                    walk(c)

        walk(node)
        return out

    def _collect_param_names(self, ast_json: Dict[str, Any]) -> List[str]:
        names: List[str] = []

        def walk(node: Any):
            if isinstance(node, dict):
                if node.get("nodeType") == "ParameterDeclaration":
                    nm = node.get("name")
                    if isinstance(nm, str) and nm:
                        names.append(nm)
                for ch in node.get("children", []) or []:
                    walk(ch)
            elif isinstance(node, list):
                for it in node:
                    walk(it)

        walk(ast_json)
        # 순서보존 dedupe
        seen: set = set()
        out: List[str] = []
        for nm in names:
            # 빈 문자열/플레이스홀더 제외 + 중복 제거
            if nm and nm != "<empty>" and nm not in seen:
                seen.add(nm)
                out.append(nm)
        return out

    def _get_condition_node(
        self, node_type: str, node: Dict[str, Any]
    ) -> Dict[str, Any] | None:
        kids = node.get("children", []) or []
        if node_type in {"IfStatement", "WhileStatement", "SwitchStatement"}:
            return kids[0] if len(kids) >= 1 else None
        if node_type == "ForStatement":
            # 보편적으로 [init, cond, inc, body]
            return kids[1] if len(kids) >= 2 else None
        return None

    def _iter_calls_ast(self, node: Dict[str, Any]) -> Iterator[Tuple[str, List[Any]]]:
        def walk(n: Any):
            if not isinstance(n, dict):
                return
            nt = n.get("nodeType")
            kids = n.get("children", []) or []

            if nt == "CallExpression":
                callee = kids[0] if kids else None
                fname = (
                    callee.get("name")
                    if isinstance(callee, dict)
                    and callee.get("nodeType") == "Identifier"
                    else ""
                )
                args = kids[1:] if len(kids) > 1 else []
                yield (fname, args)
                for a in args:
                    yield from walk(a)

            elif nt in {"StandardLibCall", "UserDefinedCall"}:
                fname = n.get("name") or ""
                # ParameterList / ArgumentList 중 하나를 찾아 인자들 추출
                plist = next(
                    (
                        c
                        for c in kids
                        if isinstance(c, dict)
                        and c.get("nodeType") in {"ParameterList", "ArgumentList"}
                    ),
                    None,
                )
                args = plist.get("children", []) if isinstance(plist, dict) else []
                yield (fname, args)
                for a in args:
                    yield from walk(a)

            else:
                for ch in kids:
                    yield from walk(ch)

        yield from walk(node)

    def _idents_from_ast_node(
        self,
        node: Dict[str, Any] | None,
        *,
        skip_sizeof: bool = True,
        skip_callee: bool = True,
    ) -> List[str]:
        names: List[str] = []

        def walk(n: Any, under_sizeof: bool = False):
            if not isinstance(n, dict):
                return
            nt = n.get("nodeType")
            if nt == "SizeOfExpression":
                for c in n.get("children", []) or []:
                    # sizeof 내부는 USE로 세지 않음
                    walk(c, True if skip_sizeof else under_sizeof)
                return
            if nt == "CallExpression":
                first = True
                for c in n.get("children", []) or []:
                    if (
                        first
                        and skip_callee
                        and isinstance(c, dict)
                        and c.get("nodeType") == "Identifier"
                    ):
                        first = False
                        continue  # callee 식별자는 변수 아님
                    first = False
                    walk(c, under_sizeof)
                return
            if nt == "Identifier":
                nm = n.get("name")
                if (
                    isinstance(nm, str)
                    and nm
                    and nm not in KEYWORDS
                    and not under_sizeof
                ):
                    names.append(nm)
            for c in n.get("children", []) or []:
                walk(c, under_sizeof)

        walk(node, False)
        # 순서보존 dedupe
        seen: set = set()
        out: List[str] = []
        for nm in names:
            if nm not in seen:
                seen.add(nm)
                out.append(nm)
        return out

    def _has_indexing(
        self, node: Dict[str, Any] | None, *, skip_sizeof: bool = True
    ) -> bool:
        found = False

        def walk(n: Any, under_sizeof: bool = False):
            nonlocal found
            if found or not isinstance(n, dict):
                return
            nt = n.get("nodeType")
            if nt == "SizeOfExpression":
                for c in n.get("children", []) or []:
                    walk(c, True if skip_sizeof else under_sizeof)
                return
            if nt == "ArraySubscriptExpression":
                found = True
                return
            # *(p+i) 같은 포인터 간접의 단순 패턴 (Unary * + Binary +|-)
            if nt in {"UnaryOperator", "UnaryExpression"} and n.get("operator") == "*":
                for ch in n.get("children", []) or []:
                    if (
                        isinstance(ch, dict)
                        and ch.get("nodeType") == "BinaryExpression"
                        and ch.get("operator") in {"+", "-"}
                    ):
                        found = True
                        return
            for c in n.get("children", []) or []:
                walk(c, under_sizeof)

        walk(node, False)
        return found

    # 선언 초기화 번들 감지 헬퍼
    # 패턴으로 name[...] = { (배열 브레이스 초기화) 또는 name[...] = "..."(문자열 리터럴 초기화)를 체크
    # 그리고 직전 1~2개 평탄화 노드가 ArrayDeclaration/ArraySizeAllocation이며 이름이 같은지 확인 (번들 구조 보완)
    def _is_decl_init_trick(
        self, sid: int, name: str, assign_node: Dict[str, Any]
    ) -> bool:
        code = assign_node.get("code") or ""
        if not name or not code:
            return False
        # 패턴: name[ ... ] = { ... }  또는  name[ ... ] = "..."
        pat_brace = r"^\s*" + re.escape(name) + r"\s*\[[^\]]+\]\s*=\s*\{"
        pat_str = r"^\s*" + re.escape(name) + r"\s*\[[^\]]+\]\s*=\s*\""
        if re.search(pat_brace, code) or re.search(pat_str, code):
            return True

        # 인접 평탄화 노드 검사 (ArrayDecl/ArraySizeAlloc + 같은 name)
        idx = None
        for i, n in enumerate(self.nodes):
            if n["sid"] == sid:
                idx = i
                break
        if idx is None:
            return False

        def _name_from_orig(row_sid: int) -> str:
            flat = self._find_ast_row_by_sid(row_sid)
            orig = self._orig_for_stmt(flat)
            if not isinstance(orig, dict):
                return ""
            nm = orig.get("name") if isinstance(orig.get("name"), str) else ""
            if not nm:
                for ch in orig.get("children", []) or []:
                    if isinstance(ch, dict) and ch.get("nodeType") == "Identifier":
                        n2 = ch.get("name")
                        if isinstance(n2, str) and n2:
                            return n2
            return nm or ""

        for j in (idx - 1, idx - 2):
            if j >= 0:
                nt = self.nodes[j]["node_type_id"]
                if nt in {"ArrayDeclaration", "ArraySizeAllocation"}:
                    if _name_from_orig(self.nodes[j]["sid"]) == name:
                        return True
        return False

    def _assignment_by_ast(
        self, assign_node: Dict[str, Any], cur_sid: int
    ) -> Tuple[List[str], List[Tuple[str, str]], int, int]:
        """AssignmentExpression 전용: (def_vars, uses[(var,role)], is_buffer_access, is_sink)"""
        def_vars: List[str] = []
        uses: List[Tuple[str, str]] = []
        iba, is_sink = 0, 0
        kids = assign_node.get("children", []) or []
        lhs = kids[0] if len(kids) >= 1 else None
        rhs = kids[1] if len(kids) >= 2 else None
        base_name: Optional[str] = None

        # --- helper: LHS 텍스트 기반 인덱싱 보조 감지
        # int buffer[10] = { 0 }; 와 같은 케이스를 지원하기 위함
        # buffer[ ... ] = 패턴이 있으면 is_buffer_access=1로 잡고, 인덱스가 비상수 식별자를 포함하면 is_sink=1
        def _lhs_textual_indexing(node: Dict[str, Any], name: str) -> Tuple[bool, bool]:
            """
            code 문자열의 '=' 왼쪽에서  name[ ... ]  패턴을 감지.
            return: (has_indexing, index_has_identifier_for_sink)
            - has_indexing: LHS에 서브스크립트가 있으면 True
            - index_has_identifier_for_sink: sizeof(...) 제거 후에도 식별자가 남으면 True
            """
            code = (node.get("code") or "") if isinstance(node, dict) else ""
            if not code or not name:
                return (False, False)
            left = code.split("=", 1)[0]
            pattern = r"\b" + re.escape(name) + r"\s*\[([^\]]+)\]"
            m = re.search(pattern, left)
            if not m:
                return (False, False)
            idx_expr = m.group(1)
            # sizeof(...) 토막 제거 후 식별자 존재 여부 확인 → sink 판별에만 사용
            idx_no_sizeof = re.sub(r"\bsizeof\s*\([^)]*\)", "", idx_expr)
            has_ident = bool(re.search(r"[A-Za-z_]\w*", idx_no_sizeof))
            return (True, has_ident)

        if isinstance(lhs, dict) and lhs.get("nodeType") == "ArraySubscriptExpression":
            base, index = (lhs.get("children") or [None, None])[:2]
            # base DEF
            if isinstance(base, dict) and base.get("nodeType") == "Identifier":
                base_name = base.get("name")
                if (
                    isinstance(base_name, str)
                    and base_name
                    and base_name not in KEYWORDS
                ):
                    def_vars.append(base_name)
            # index USE
            for t in self._idents_from_ast_node(
                index, skip_sizeof=True, skip_callee=True
            ):
                uses.append((t, "index"))
            iba = 1
            is_sink = 1 if uses else 0  # 인덱스가 런타임 식별자를 포함할 때만
        elif isinstance(lhs, dict) and lhs.get("nodeType") == "Identifier":
            base_name = lhs.get("name")
            if isinstance(base_name, str) and base_name and base_name not in KEYWORDS:
                def_vars.append(base_name)
                _has_idx, _idx_has_ident = _lhs_textual_indexing(assign_node, base_name)
                if _has_idx:
                    # 선언 초기화 번들이면 런타임 접근으로 보지 않음
                    if not self._is_decl_init_trick(cur_sid, base_name, assign_node):
                        iba = 1
                        if _idx_has_ident:
                            is_sink = 1

        else:
            # 기타 LHS 표현식: 첫 식별자 DEF로 보수적 처리
            ids = self._idents_from_ast_node(lhs, skip_sizeof=True, skip_callee=True)
            if ids:
                def_vars.append(ids[0])

        # RHS value USE + RHS 인덱싱 읽기 감지
        for t in self._idents_from_ast_node(rhs, skip_sizeof=True, skip_callee=True):
            if t != base_name:
                uses.append((t, "value"))
        if self._has_indexing(rhs, skip_sizeof=True):
            iba = 1

        return def_vars, uses, iba, is_sink

    def _array_decl_by_ast(
        self, arr_node: Dict[str, Any]
    ) -> Tuple[List[str], List[Tuple[str, str]]]:
        """ArrayDeclaration/ArraySizeAllocation: (def_vars, size_uses) — sizeof 내부는 제외"""
        def_vars: List[str] = []
        uses: List[Tuple[str, str]] = []
        name = arr_node.get("name") if isinstance(arr_node.get("name"), str) else None
        if not name:
            for ch in arr_node.get("children", []) or []:
                if isinstance(ch, dict) and ch.get("nodeType") == "Identifier":
                    nm = ch.get("name")
                    if isinstance(nm, str) and nm:
                        name = nm
                        break
        if name and name not in KEYWORDS:
            def_vars.append(name)
        # size 표현 내부 식별자 수집 (sizeof 내부 제외)
        for ch in arr_node.get("children", []) or []:
            for t in self._idents_from_ast_node(ch, skip_sizeof=True, skip_callee=True):
                uses.append((t, "size"))
        # 순서보존 dedupe
        seen: set = set()
        out: List[Tuple[str, str]] = []
        for item in uses:
            if item not in seen:
                seen.add(item)
                out.append(item)
        return def_vars, out

    # ------------------------------
    # Calls: 역할 매핑 (AST 노드 인자)
    # ------------------------------
    def _call_arg_uses_ast(
        self, fname: str, arg_nodes: List[Dict[str, Any]]
    ) -> List[Tuple[str, str]]:
        out: List[Tuple[str, str]] = []

        # helper: arg 노드에서 식별자 추출
        def idents(arg: Dict[str, Any]) -> List[str]:
            return self._idents_from_ast_node(arg, skip_sizeof=True, skip_callee=True)

        if fname in {"memcpy", "memmove"}:
            if len(arg_nodes) >= 2:
                for t in idents(arg_nodes[1]):
                    out.append((t, "value"))  # src
            if len(arg_nodes) >= 3:
                for t in idents(arg_nodes[2]):
                    out.append((t, "size"))  # n
        elif fname in {"snprintf", "sprintf"}:
            if len(arg_nodes) >= 2:
                for t in idents(arg_nodes[1]):
                    out.append((t, "size"))
        elif fname in {"fgets", "gets", "read", "recv", "getline"}:
            if len(arg_nodes) >= 2:
                for t in idents(arg_nodes[1]):
                    out.append((t, "size"))
        else:
            for a in arg_nodes:
                for t in idents(a):
                    out.append((t, "value"))
        return out

    def _call_write_effects_ast(
        self, fname: str, arg_nodes: List[Dict[str, Any]]
    ) -> List[str]:
        defs: List[str] = []

        def first_ident(node: Dict[str, Any] | None) -> str:
            ids = self._idents_from_ast_node(node, skip_sizeof=True, skip_callee=True)
            return ids[0] if ids else ""

        if fname in {"fgets", "gets"} and len(arg_nodes) >= 1:
            b = first_ident(arg_nodes[0])
            b and defs.append(b)
        if fname in {"scanf", "fscanf"} and len(arg_nodes) >= 2:
            for a in arg_nodes[1:]:
                # &v 패턴: UnaryOperator '&' 아래 Identifier를 찾는다
                nm = self._extract_address_of_ident(a)
                if nm:
                    defs.append(nm)
        if fname in {"recv", "read", "getline"} and len(arg_nodes) >= 2:
            b = first_ident(arg_nodes[1])
            b and defs.append(b)
        if fname in {"memcpy", "memmove", "strcpy", "strcat"} and len(arg_nodes) >= 1:
            d = first_ident(arg_nodes[0])
            d and defs.append(d)
        if fname in {"snprintf", "sprintf"} and len(arg_nodes) >= 1:
            b = first_ident(arg_nodes[0])
            b and defs.append(b)
        return defs

    def _extract_address_of_ident(self, node: Dict[str, Any] | None) -> str:
        """scanf류 인자의 &v 에서 v 추출 (단순 패턴)"""
        if not isinstance(node, dict):
            return ""
        nt = node.get("nodeType")
        if nt in {"UnaryOperator", "UnaryExpression"} and node.get("operator") == "&":
            for ch in node.get("children", []) or []:
                if isinstance(ch, dict) and ch.get("nodeType") == "Identifier":
                    nm = ch.get("name")
                    if isinstance(nm, str):
                        return nm
        # 더 깊은 경우에도 첫 식별자 반환
        ids = self._idents_from_ast_node(node, skip_sizeof=True, skip_callee=True)
        return ids[0] if ids else ""

    # ------------------------------
    # Guard map (AST 조건 서브트리로 분석)
    # ------------------------------
    def _build_guard_map(self) -> Dict[int, Dict[str, Dict[str, Any]]]:
        # dst_sid → { var: {lower, upper, upper_const, kind} }
        node_by_sid = {n.get("sid"): n for n in self.ast_nodes}
        gmap: Dict[int, Dict[str, Dict[str, Any]]] = {}
        for g in self.ast_guard:
            src_sid = g.get("src")
            dst_sid = g.get("dst")
            src_row = node_by_sid.get(src_sid, {})
            src_orig = self._orig_for_stmt(src_row)
            kind = g.get("guard_kind", 0)  # 1=if,2=loop
            cond_node = None
            if isinstance(src_orig, dict):
                cond_node = self._get_condition_node(
                    src_row.get("node_type_id", ""), src_orig
                )
            info = self._guards_from_condition_ast(cond_node)
            for v in info.values():
                v["kind"] = kind
            if info:
                gmap.setdefault(dst_sid, {})
                gmap[dst_sid].update(info)
        return gmap

    def _guards_from_condition_ast(
        self, cond_node: Dict[str, Any] | None
    ) -> Dict[str, Dict[str, Any]]:
        """간단한 패턴: x>=0 / x>0 → lower,  x<=K / x<K → upper(K 정규화)
        BinaryExpression 기준으로만 처리(필요시 확대 가능).
        """
        res: Dict[str, Dict[str, Any]] = {}
        if not isinstance(cond_node, dict):
            return res

        def norm(v: int) -> float:
            return (v if v < 100 else 100) / 100.0

        def walk(n: Any):
            if not isinstance(n, dict):
                return
            nt = n.get("nodeType")
            if nt == "BinaryExpression":
                op = n.get("operator")
                kids = n.get("children", []) or []
                L = kids[0] if len(kids) >= 1 else None
                R = kids[1] if len(kids) >= 2 else None
                # 좌변 식별자, 우변 정수 상수 형태만 간단히 지원
                if (
                    isinstance(L, dict)
                    and L.get("nodeType") == "Identifier"
                    and isinstance(R, dict)
                    and R.get("nodeType") == "Literal"
                ):
                    nm = L.get("name")
                    val = R.get("value")
                    if isinstance(nm, str) and isinstance(val, str) and val.isdigit():
                        v = int(val)
                        res.setdefault(nm, {"lower": 0, "upper": 0, "upper_const": 0.0})
                        if op in {">=", ">"}:
                            res[nm]["lower"] = 1
                        if op in {"<=", "<"}:
                            res[nm]["upper"] = 1
                            res[nm]["upper_const"] = norm(v)
                # 반대 방향도 간단히 처리: K > x, K >= x 등은 lower/upper 해석이 달라 복잡 → 생략
            for ch in n.get("children", []) or []:
                walk(ch)

        walk(cond_node)
        return res
