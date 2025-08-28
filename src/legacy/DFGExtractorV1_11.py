# V11이후 수정사항
# 1) Def-Use 에지의 printIntLine(buffer[i]) 에러 수정
#    flow_id : 1-> 2, has_lower_guard : 0 -> 1
# 2) if (fgets(inputBuffer, 3*sizeof(data)+2, stdin) != NULL)) 노드 에러 수정
#    call_len_linked_to_dst : 0 --> 1
#     - 컨트롤 노드(If/While/For)의 조건식 안에 있는 bounded 호출(fgets, memcpy, snprintf, read 등)을 처리할 때,
#       종전: size에 sizeof(dst)가 포함될때만 call_len_linked_to_dst=1
#       변경: sizeof(dst)뿐 아니라, dst 배열의 선언 길이 표현식과 size 표현식이 정규화 후 동일하면 call_len_linked_to_dst=1로 설정
#       (ex. inputBuffer가 char inputBuffer[3*sizeof(data)+2]로 선언되어 있고, fgets(inputBuffer, 3*sizeof(data)+2, stdin)이면 링크로 판정)
#       이 로직은 컨트롤 노드 분기에서만 적용되며, call_size_nonconst는 링크로 판정되면 0으로 정정합니다.
# 3)CWE121_129_fget_G2B 케이스 오류 수정
#   제어노드에서 함수 호출케이스가 없는경우 에러 발생 해결
# 4)ForStatement (i=0,..) DEF-USE 문제 해결
#   :int i;(4) → for(i=0;i<10;i++)(9) → printIntLine(buffer[i])(10)인 경우, i의 런타임 값을 정의(DEF)하는 주체는 for 헤더의 i=0·i++ 이고, 그 값이 for 조건·바디에서 사용(USE)된다.
#   - 변경전 4 -> 9, 4 -> 10
#   - 변걍후 9 -> 9, 9 -> 10 (ForStatement를 i의 “정의 문장(DEF)”로도 인정)
#     초기화(i = 0)와
#     증감(i++, i += k, --i …)를 DEF로 반영하고, 그걸 조건 USE보다 먼저 기록
# 5) CWE121_TypeOverRun 케이스 커버
#   * MeberAccess 처리
#     - var_key: "{base}.{field}@sid"
#     - LHS MemberAccess
#     - SizeOfExpression 안의 MemberAccess도 USE로 수집.
#    * 호출 인자 매핑 보강
#     - dst가 MemberAccess인지 식별, (dst_base, dst_field) 추출.
#    * 길이 연계 판정 확장
#     - len_linked(dst)에 sizeof(base.field) 포함.
#     - sizeof_non_dst = 1 if sizeof(structVar) AND dst == structVar.field.


import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

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
class DFGExtractorV1_12:
    def __init__(
        self,
        ast_json: Dict[str, Any],
        ast_result: Dict[str, Any],
        sink_mode: str = "k1",
    ):
        self.ast_json = ast_json
        self.ast_nodes = ast_result.get("nodes", [])
        self.ast_guard = ast_result.get("edges_ast_guard", [])
        self.pointer_vars: Set[str] = self._collect_pointer_names(
            self.ast_json
        )  # PointerDeclaration 수집

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
        self.edges_defuse: List[Tuple[int, int, Dict[str, Any]]] = (
            []
        )  # ← flat Def→Use (수집용)

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

        # 최종 출력 엣지(‘feat’/‘debug’ 분리)는 run()에서 self.edges로 조립
        self.edges: List[Tuple[int, int, Dict[str, Any]]] = []

        # dst SID 기준 가드 주입을 위해 (sid→feat) 캐시
        self._sid2feat: Dict[int, Dict[str, Any]] = {
            int(r.get("sid")): (r.get("feat") or {})
            for r in self.ast_nodes
            if "sid" in r
        }

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

            # 디버그/카운트용 use 변수: base는 제외 (에지로만 표현)
            if role != "base":
                use_vars_by_sid[dst_sid].add(var)

            # Def→Use 에지는 마지막 DEF가 있을 때만
            if var not in last_def:
                return
            src = last_def[var]

            # flow_id 결정 (기본 value=1), base=4, index=2, size=3 등
            fid = FLOW_ID.get(role or "value", FLOW_ID["value"])

            key = (src, dst_sid, var, fid)
            if key in seen_edges:
                return
            seen_edges.add(key)

            # ★ dst SID 기준 가드 컨텍스트 적용
            gi = self._guard_ctx_by_sid(dst_sid)

            # 페이로드는 평평한 구조(하위 단계 호환)
            self.edges_defuse.append(
                (
                    src,
                    dst_sid,
                    {
                        "var_key": f"{var}@{src}",
                        "flow_id": fid,
                        "guard_kind": gi.get("kind", 0),
                        "has_lower_guard": gi.get("lower", 0),
                        "has_upper_guard": gi.get("upper", 0),
                        "upper_guard_norm": gi.get("upper_const", 0.0),
                    },
                )
            )

        # 메인 루프: AST 노드 순회
        for row in self.nodes:
            sid = row["sid"]
            code = row["code"]
            node_type = row["node_type_id"]

            ensure_feat(sid, node_type)
            node_debug[sid]["code"] = code

            orig = self._orig_for_stmt(self._find_ast_row_by_sid(sid))

            # (0) 문장 내부 호출 처리 (컨트롤 노드는 전체 subtree 제외)
            # Special-case: statement-level call nodes may have orig pointing to ParameterList/ArgumentList.
            # In that case, add index-role uses (buffer[i] -> i as index) explicitly.
            if (
                node_type in {"UserDefinedCall", "StandardLibCall"}
                and isinstance(orig, dict)
                and orig.get("nodeType") in {"ParameterList", "ArgumentList"}
            ):
                # 함수명 추출 (memmove(...), fgets(...), ...)
                fname = self._callee_name_from_arglist(orig)
                base = (fname or "").lower()

                arg_nodes = orig.get("children") or []

                # 1) 인자 USE (역할별: index/size/base/value)
                for v, role in self._call_arg_uses_ast(base, arg_nodes):
                    if role == "base":
                        continue
                    used_by_call_stmt.add(v)
                    _add_use_edge(v, role, sid)

                # 2) 쓰기효과 DEF (dst 등)
                for v in self._call_write_effects_ast(base, arg_nodes):
                    if v and v not in KEYWORDS:
                        last_def[v] = sid
                        def_vars_by_sid[sid].add(v)
                        exclude_vars_stmt.add(v)  # dst는 토큰 USE에서 제외

                # 3) 호출 기반 sink/증거 비트
                dst_arg, size_arg = _pick_dst_size_args(base, arg_nodes)

                # dst 인덱싱 여부
                dst_indexed = 1 if self._has_indexing(dst_arg, skip_sizeof=True) else 0

                # len-linked / size nonconst (필드 감도 확장)
                size_txt = (
                    (size_arg.get("code") or "") if isinstance(size_arg, dict) else ""
                )
                dst_names = (
                    set(self._idents_from_ast_node(dst_arg))
                    if isinstance(dst_arg, dict)
                    else set()
                )
                dst_full = (
                    self._fullname_from_expr(dst_arg)
                    if isinstance(dst_arg, dict)
                    else None
                )
                if dst_full:
                    dst_names.add(dst_full)

                linked = 0
                if size_txt and dst_names:
                    sizeof_hits = any(
                        ("sizeof(" + dn + ")") in size_txt
                        or ("sizeof(*" + dn + ")") in size_txt
                        or ("sizeof(" + dn + "[0])") in size_txt
                        for dn in dst_names
                    )
                    linked = 1 if sizeof_hits else 0

                # 선언 길이와 동일하면 링크로 인정 (기존 규칙 유지)
                if not linked and dst_names:
                    dst_name = next(iter(dst_names))

                    def _decl_len(var):
                        st = [self.ast_json]
                        import re as _re

                        while st:
                            nn = st.pop()
                            if (
                                isinstance(nn, dict)
                                and nn.get("nodeType") == "ArrayDeclaration"
                                and nn.get("name") == var
                            ):
                                l = nn.get("length")
                                if isinstance(l, str) and l:
                                    return l
                                code0 = nn.get("code", "") or ""
                                m0 = _re.search(r"\[\s*(.*?)\s*\]", code0)
                                if m0:
                                    return m0.group(1)
                            if isinstance(nn, dict):
                                st.extend(
                                    [
                                        c
                                        for c in (nn.get("children") or [])
                                        if isinstance(c, dict)
                                    ]
                                )
                        return None

                    decl = _decl_len(dst_name)
                    if decl:
                        import re as _re

                        def _norm(s):
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

                        if _norm(size_txt) == _norm(decl):
                            linked = 1

                size_txt_wo_sizeof = re.sub(r"\bsizeof\s*\([^)]*\)", "", size_txt)
                nonconst = (
                    1
                    if (size_txt and re.search(r"[A-Za-z_]\w*", size_txt_wo_sizeof))
                    else 0
                )
                if size_txt and ("sizeof(" in size_txt):
                    # dst 관련 sizeof가 하나도 없으면 non-dst
                    if not any(("sizeof(" + dn + ")") in size_txt for dn in dst_names):
                        nonconst = 1
                    # dst가 base.field인데 size가 sizeof(base)면 명시적으로 non-dst
                    if dst_full and "." in dst_full:
                        base_only = dst_full.split(".")[0]
                        if ("sizeof(" + base_only + ")") in size_txt:
                            nonconst = 1

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

                # ✅ We fully handled this statement-level call (roles, DEFs, flags).
                #    Skip generic value-scan to avoid double-counting.
                continue

            exclude_vars_stmt: Set[str] = set()
            used_by_call_stmt: Set[str] = set()

            # (removed) Pre-marking of index variables is unnecessary:
            # roles are already handled in _call_arg_uses_ast(), and
            # the statement-level call block below ends with `continue`.

            # 일반 문장내 호출 처리
            if isinstance(orig, dict) and (node_type not in CONTROL_NODES):
                for fname, arg_nodes in self._iter_calls_ast(orig):
                    base = (fname or "").lower()

                    # 인자 USE (역할 매핑)
                    for v, role in self._call_arg_uses_ast(fname, arg_nodes):
                        if role == "base":
                            # dst는 USE가 아님 + generic value 스캔에서도 제외
                            exclude_vars_stmt.add(v)
                            continue

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

                    # len-linked / size nonconst (필드 감도 확장)
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
                    dst_full = (
                        self._fullname_from_expr(dst_arg)
                        if isinstance(dst_arg, dict)
                        else None
                    )
                    if dst_full:
                        dst_names.add(dst_full)

                    linked = 0
                    if size_txt and dst_names:
                        sizeof_hits = any(
                            ("sizeof(" + dn + ")") in size_txt
                            or ("sizeof(*" + dn + ")") in size_txt
                            or ("sizeof(" + dn + "[0])") in size_txt
                            for dn in dst_names
                        )
                        linked = 1 if sizeof_hits else 0

                    # 선언 길이와 동일하면 링크로 간주 (기존 규칙 유지)
                    if not linked and dst_names:
                        dst_name = next(iter(dst_names))

                        def _decl_len(var):
                            st = [self.ast_json]
                            import re as _re

                            while st:
                                nn = st.pop()
                                if (
                                    isinstance(nn, dict)
                                    and nn.get("nodeType") == "ArrayDeclaration"
                                    and nn.get("name") == var
                                ):
                                    l = nn.get("length")
                                    if isinstance(l, str) and l:
                                        return l
                                    code0 = nn.get("code", "") or ""
                                    m0 = _re.search(r"\[\s*(.*?)\s*\]", code0)
                                    if m0:
                                        return m0.group(1)
                                if isinstance(nn, dict):
                                    st.extend(
                                        [
                                            c
                                            for c in (nn.get("children") or [])
                                            if isinstance(c, dict)
                                        ]
                                    )
                            return None

                        decl = _decl_len(dst_name)
                        if decl:
                            import re as _re

                            def _norm(s):
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

                            if _norm(size_txt) == _norm(decl):
                                linked = 1

                    size_txt_wo_sizeof = re.sub(r"\bsizeof\s*\([^)]*\)", "", size_txt)
                    nonconst = (
                        1
                        if (size_txt and re.search(r"[A-Za-z_]\w*", size_txt_wo_sizeof))
                        else 0
                    )
                    if size_txt and ("sizeof(" in size_txt):
                        if not any(
                            ("sizeof(" + dn + ")") in size_txt for dn in dst_names
                        ):
                            nonconst = 1
                        if dst_full and "." in dst_full:
                            base_only = dst_full.split(".")[0]
                            if ("sizeof(" + base_only + ")") in size_txt:
                                nonconst = 1

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
            # DFGExtractorV1_12j
            if node_type in CONTROL_NODES and isinstance(orig, dict):
                cond_node = self._get_condition_node(node_type, orig)
                if cond_node is not None:
                    exclude_vars_cond: Set[str] = set()
                    used_by_call_cond: Set[str] = set()

                    # ForStatement 헤더 DEF 시딩 (i=0, i++, i+=k 등 → i를 DEF로 인정)
                    def_names: Set[str] = set()
                    if node_type == "ForStatement":
                        kids = orig.get("children") or []
                        init = kids[0] if len(kids) >= 1 else None
                        inc = kids[2] if len(kids) >= 3 else None

                        def_names: Set[str] = set()

                        # 1) 초기화: i = <expr> 꼴이면 LHS 식별자를 DEF로
                        if (
                            isinstance(init, dict)
                            and init.get("nodeType") == "AssignmentExpression"
                        ):
                            lhs, rhs = (init.get("children") or [None, None])[:2]
                            if (
                                isinstance(lhs, dict)
                                and lhs.get("nodeType") == "Identifier"
                            ):
                                nm = lhs.get("name")
                                if isinstance(nm, str) and nm and nm not in KEYWORDS:
                                    def_names.add(nm)

                        # 2) 증감: ++i, i++, --i, i--, i += k 등은 inc 표현식에서 식별자를 추출해 DEF로
                        if isinstance(inc, dict):
                            for t in self._idents_from_ast_node(
                                inc, skip_sizeof=True, skip_callee=True
                            ):
                                if t and t not in KEYWORDS:
                                    def_names.add(t)

                        # 3) DEF 반영 (조건 USE/호출 처리 전에 last_def 갱신)
                        for v in sorted(def_names):
                            last_def[v] = sid
                            def_vars_by_sid[sid].add(v)

                    # (a) 조건 내부 호출 먼저 처리 — per-call 안에서만 계산
                    for fname, arg_nodes in self._iter_calls_ast(cond_node):
                        base = (fname or "").lower()

                        # 인자 USE
                        for v, role in self._call_arg_uses_ast(fname, arg_nodes):
                            # dst(base)는 읽기가 아님 → USE 제외
                            if role == "base":
                                continue

                            used_by_call_cond.add(v)
                            _add_use_edge(v, role, sid)

                        # 쓰기효과 DEF
                        for v in self._call_write_effects_ast(fname, arg_nodes):
                            if v and v not in KEYWORDS:
                                last_def[v] = sid
                                def_vars_by_sid[sid].add(v)
                                exclude_vars_cond.add(v)

                        # ---- 호출 기반 sink/증거 비트 (per-call) ----
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
                        dst_full = (
                            self._fullname_from_expr(dst_arg)
                            if isinstance(dst_arg, dict)
                            else None
                        )
                        if dst_full:
                            dst_names.add(dst_full)

                        linked = 0
                        if size_txt and dst_names:
                            sizeof_hits = any(
                                ("sizeof(" + dn + ")") in size_txt
                                or ("sizeof(*" + dn + ")") in size_txt
                                or ("sizeof(" + dn + "[0])") in size_txt
                                for dn in dst_names
                            )
                            linked = 1 if sizeof_hits else 0

                        if not linked and dst_names:
                            dst_name = next(iter(dst_names))

                            def _decl_len(var):
                                st = [self.ast_json]
                                import re as _re

                                while st:
                                    nn = st.pop()
                                    if (
                                        isinstance(nn, dict)
                                        and nn.get("nodeType") == "ArrayDeclaration"
                                        and nn.get("name") == var
                                    ):
                                        l = nn.get("length")
                                        if isinstance(l, str) and l:
                                            return l
                                        code0 = nn.get("code", "") or ""
                                        m0 = _re.search(r"\[\s*(.*?)\s*\]", code0)
                                        if m0:
                                            return m0.group(1)
                                    if isinstance(nn, dict):
                                        st.extend(
                                            [
                                                c
                                                for c in (nn.get("children") or [])
                                                if isinstance(c, dict)
                                            ]
                                        )
                                return None

                            decl = _decl_len(dst_name)
                            if decl:
                                import re as _re

                                def _norm(s):
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

                                if _norm(size_txt) == _norm(decl):
                                    linked = 1

                        size_txt_wo_sizeof = re.sub(
                            r"\bsizeof\s*\([^)]*\)", "", size_txt
                        )
                        nonconst = (
                            1
                            if (
                                size_txt
                                and re.search(r"[A-Za-z_]\w*", size_txt_wo_sizeof)
                            )
                            else 0
                        )
                        if size_txt and ("sizeof(" in size_txt):
                            if not any(
                                ("sizeof(" + dn + ")") in size_txt for dn in dst_names
                            ):
                                nonconst = 1
                            if dst_full and "." in dst_full:
                                base_only = dst_full.split(".")[0]
                                if ("sizeof(" + base_only + ")") in size_txt:
                                    nonconst = 1

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
                "PointerDeclaration",
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
            feat["use_count"] = len(ulist)  # base 제외된 목록 기준
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

    # -----------------------------------------------------------------
    # run 함수 끝
    # ----------------------------------------------------------------

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

    # --------------------------------------------------------------------
    # Field-sensitive helpers (MemberAccess / MemberExpression)
    # --------------------------------------------------------------------
    def _is_member_access(self, n):
        return isinstance(n, dict) and n.get("nodeType") == "MemberAccess"

    def _member_parts(self, n):
        """Return (base_name, field_name, full_name='base.field') for a member access node."""
        if not self._is_member_access(n):
            return None, None, None
        kids = n.get("children") or []
        base = kids[0] if len(kids) > 0 else None
        field = kids[1] if len(kids) > 1 else None
        base_name = (
            base.get("name")
            if isinstance(base, dict) and base.get("nodeType") == "Identifier"
            else None
        )
        field_name = (
            field.get("name")
            if isinstance(field, dict) and field.get("nodeType") == "Identifier"
            else None
        )
        full = f"{base_name}.{field_name}" if base_name and field_name else None
        return base_name, field_name, full

    def _unwrap_cast_paren(self, n):
        """Peel Cast/Paren wrappers to reach the core expression."""
        while isinstance(n, dict) and n.get("nodeType") in {
            "CastExpression",
            "CStyleCastExpr",
            "ParenExpression",
            "ParenExpr",
        }:
            kids = n.get("children") or []
            n = kids[0] if kids else n
        return n

    def _fullname_from_expr(self, n):
        """Return identifier (with field-sensitivity, e.g., 's.charFirst') from an expression.
        Handles PointerDereference/Unary '*'/'&', Cast/Paren, and ArraySubscript base.
        """
        # 0) null/primitive guard
        if n is None:
            return None

        # 1) unwrap cast/paren first
        n = self._unwrap_cast_paren(n)

        # 2) if array subscript, resolve its base first-child
        if isinstance(n, dict) and n.get("nodeType") == "ArraySubscriptExpression":
            kids = n.get("children") or []
            n = kids[0] if kids else n
            n = self._unwrap_cast_paren(n)

        # 3) peel pointer dereference or address-of to reach the underlying lvalue
        while isinstance(n, dict) and (
            n.get("nodeType") == "PointerDereference"
            or (
                n.get("nodeType") in {"UnaryOperator", "UnaryExpression"}
                and n.get("operator") in {"*", "&"}
            )
        ):
            kids = n.get("children") or []
            n = kids[0] if kids else n
            n = self._unwrap_cast_paren(n)

        # 4) member access wins (field-sensitivity)
        if self._is_member_access(n):
            return self._member_parts(n)[2]

        # 5) plain identifier
        if isinstance(n, dict) and n.get("nodeType") == "Identifier":
            return n.get("name")

        return None

    # ------------------------------
    # PointerDeclaration 수집
    # ------------------------------
    def _collect_pointer_names(self, ast_json: Dict[str, Any]) -> Set[str]:
        names: Set[str] = set()

        def walk(node):
            if isinstance(node, dict):
                if node.get("nodeType") == "PointerDeclaration":
                    nm = node.get("name")
                    if isinstance(nm, str) and nm:
                        names.add(nm)
                for ch in node.get("children") or []:
                    walk(ch)
            elif isinstance(node, list):
                for it in node:
                    walk(it)

        walk(ast_json)
        return names

    def _find_enclosing_call_for(self, node: dict) -> dict | None:
        """ParameterList/ArgumentList 노드의 상위 CallExpression을 찾아 반환."""
        if not isinstance(node, dict):
            return None
        target = node
        target_id = node.get("id") or node.get("orig_id")
        stack = [self.ast_json]
        while stack:
            n = stack.pop()
            if not isinstance(n, dict):
                continue
            if n.get("nodeType") in {
                "StandardLibCall",
                "UserDefinedCall",
                "CallExpression",
            }:
                for c in n.get("children") or []:
                    if not isinstance(c, dict):
                        continue
                    if c is target:
                        return n
                    cid = c.get("id") or c.get("orig_id")
                    if target_id is not None and cid is not None and cid == target_id:
                        return n
            stack.extend([c for c in (n.get("children") or []) if isinstance(c, dict)])
        return None

    def _callee_name_from_arglist(self, arglist_node: dict) -> str:
        """ParameterList/ArgumentList에서 callee 이름을 AST의 name으로 가져옴.
        CallExpression.name이 없으면 첫 자식 Identifier.name 사용."""
        call = self._find_enclosing_call_for(arglist_node)
        if not isinstance(call, dict):
            return ""
        nm = call.get("name")
        if isinstance(nm, str) and nm:
            return nm
        kids = call.get("children") or []
        if (
            kids
            and isinstance(kids[0], dict)
            and kids[0].get("nodeType") == "Identifier"
        ):
            nm2 = kids[0].get("name")
            if isinstance(nm2, str) and nm2:
                return nm2
        return ""

    def _iter_calls_ast(self, node: Dict[str, Any]):

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
        """
        식별자(이름) 추출기.
         - Identifier: 그대로 수집
         - MemberAccess/MemberExpression: 'base.field[.subfield...]'로 풀네임 1토큰으로 수집 (필드 감도)
         - sizeof(...) 내부 식별자는 기본 스킵(skip_sizeof=True)
         - CallExpression의 첫 자식(callee)은 기본 스킵(skip_callee=True)
         - 순서 보존 중복 제거
        """

        names: List[str] = []

        def _member_full_name(n: Dict[str, Any]) -> str | None:
            """
            재귀적으로 base.field[.subfield...] 풀네임 생성.
            base는 Identifier 또는 다시 MemberAccess일 수 있음.
            """
            if not isinstance(n, dict):
                return None
            nt = n.get("nodeType")
            if nt == "MemberAccess":
                kids = n.get("children") or []
                base = kids[0] if len(kids) > 0 else None
                field = kids[1] if len(kids) > 1 else None
                base_full = _member_full_name(base) or (
                    base.get("name")
                    if isinstance(base, dict) and base.get("nodeType") == "Identifier"
                    else None
                )
                field_name = (
                    field.get("name")
                    if isinstance(field, dict) and field.get("nodeType") == "Identifier"
                    else None
                )
                if base_full and field_name:
                    return f"{base_full}.{field_name}"
                return None
            elif nt == "Identifier":
                nm = n.get("name")
                return nm if isinstance(nm, str) and nm and nm not in KEYWORDS else None
            else:
                return None

        def walk(n: Any, under_sizeof: bool = False):
            if not isinstance(n, dict):
                return
            nt = n.get("nodeType")
            if nt == "SizeOfExpression":
                for c in n.get("children", []) or []:
                    # sizeof 내부는 USE로 세지 않음
                    walk(c, True if skip_sizeof else under_sizeof)
                return

            if nt in {"StandardLibCall", "UserDefinedCall", "CallExpression"}:
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

            # 필드 접근: base.field[.subfield...]를 1토큰으로 수집하고 하위는 더 안 탐색
            if nt == "MemberAccess":
                if not under_sizeof:
                    full = _member_full_name(n)
                    if full and full not in KEYWORDS:
                        names.append(full)
                return  # 중복 수집 방지

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

            # LHS base = USE(주소 계산), DEF 아님
            if isinstance(base, dict):
                base_full = self._fullname_from_expr(
                    base
                )  # deref/paren/cast/field까지 내부에서 처리
                if base_full and base_full not in KEYWORDS:
                    uses.append((base_full, "base"))
            # index USE
            has_runtime_index = False
            if isinstance(index, dict):
                # 1) 디버그/에지 생성을 위해 sizeof(...) 내부도 USE로 수집
                for t in self._idents_from_ast_node(
                    index, skip_sizeof=False, skip_callee=True
                ):
                    if t and t not in KEYWORDS:
                        uses.append((t, "index"))

                # 2) 싱크 판정은 '런타임 식별자' 존재 여부로 (sizeof 내부 식별자는 제외)
                for t in self._idents_from_ast_node(
                    index, skip_sizeof=True, skip_callee=True
                ):
                    if t and t not in KEYWORDS:
                        has_runtime_index = True
                        break

            iba = 1
            is_sink = (
                1 if has_runtime_index else 0
            )  # 인덱스가 런타임 식별자를 포함할 때만

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

        # RHS 분석: 먼저 인덱스(role=index)와 베이스(role=base), 그 다음 value(중복/인덱스 제외)
        rhs_index_vars: Set[str] = set()
        if isinstance(rhs, dict) and rhs.get("nodeType") == "ArraySubscriptExpression":
            rk = rhs.get("children") or []
            rhs_base = rk[0] if len(rk) > 0 else None
            rhs_index = rk[1] if len(rk) > 1 else None
            # base USE (읽기)
            if isinstance(rhs_base, dict):
                rhs_base_full = self._fullname_from_expr(rhs_base)
                if rhs_base_full and rhs_base_full not in KEYWORDS:
                    uses.append((rhs_base_full, "base"))
            # index USE
            if isinstance(rhs_index, dict):
                for t in self._idents_from_ast_node(
                    rhs_index, skip_sizeof=False, skip_callee=True
                ):
                    if t and t not in KEYWORDS:
                        uses.append((t, "index"))
                        rhs_index_vars.add(t)

        return def_vars, uses, iba, is_sink

    def _array_decl_by_ast(
        self, decl: Dict[str, Any]
    ) -> Tuple[List[str], List[Tuple[str, str]]]:
        """
        ArrayDeclaration / ArraySizeAllocation 처리:
        - def_vars: 배열 식별자
        - uses: 길이식에서 식별자 (단, sizeof(...) 내부는 USE로 세지지 않음)
        """
        def_vars: List[str] = []
        uses: List[Tuple[str, str]] = []

        nt = decl.get("nodeType")
        if nt == "ArrayDeclaration":
            nm = decl.get("name")
            if isinstance(nm, str) and nm and nm not in KEYWORDS:
                def_vars.append(nm)
            # 길이식 추출 (스키마에 따라 children[0] 등)
            kids = decl.get("children") or []
            length = kids[0] if kids else None
            if isinstance(length, dict):
                # ✅ sizeof 내부는 USE로 세지지 않음
                for t in self._idents_from_ast_node(
                    length, skip_sizeof=True, skip_callee=True
                ):
                    if t and t not in KEYWORDS:
                        uses.append((t, "size"))
        elif nt == "ArraySizeAllocation":
            # 필요 시 동일 규칙 적용
            kids = decl.get("children") or []
            length = kids[0] if kids else None
            if isinstance(length, dict):
                for t in self._idents_from_ast_node(
                    length, skip_sizeof=True, skip_callee=True
                ):
                    if t and t not in KEYWORDS:
                        uses.append((t, "size"))

        return def_vars, uses

    # ------------------------------
    # Calls: 역할 매핑 (AST 노드 인자)
    # ------------------------------
    def _call_arg_uses_ast(
        self, fname: str, arg_nodes: List[Dict[str, Any]]
    ) -> List[Tuple[str, str]]:
        """
        호출 인자에서 USE 변수 추출.
        - ArraySubscriptExpression의 첨자(index) 식별자는 role="index"
        - API별 size 슬롯의 식별자는 role="size" (sizeof(...) 내부도 USE로 집계)
        - dst(목적지) 인자는 role="base" (필드 감도: base.field)
        - 그 밖의 식별자는 role="value"
        """
        out: List[Tuple[str, str]] = []
        seen: Set[Tuple[str, str]] = set()
        index_vars: Set[str] = set()
        size_vars: Set[str] = set()
        base_vars: Set[str] = set()

        def _emit(name: str, role: str):
            if not name or name in KEYWORDS:
                return
            key = (name, role)
            if key not in seen:
                seen.add(key)
                out.append(key)

        low = (fname or "").lower()

        # dst / size 인자 위치 매핑
        dst_pos = None
        size_pos = None
        if low in {"memcpy", "memmove", "strncpy"}:
            dst_pos, size_pos = 0, 2
        elif low in {"snprintf", "vsnprintf"}:
            dst_pos, size_pos = 0, 1
        elif low in {"fgets"}:
            dst_pos, size_pos = 0, 1
        elif low in {"read", "recv"}:
            dst_pos, size_pos = 1, 2
        elif low in {"getline"}:
            dst_pos, size_pos = 0, 1

        # 1) 모든 인자에서 배열 첨자(index) 먼저 수집 (sizeof 내부도 USE로 허용)
        for a in arg_nodes or []:
            if isinstance(a, dict) and a.get("nodeType") == "ArraySubscriptExpression":
                kids = a.get("children") or []
                idx_node = kids[1] if len(kids) > 1 else None
                if isinstance(idx_node, dict):
                    for t in self._idents_from_ast_node(
                        idx_node, skip_sizeof=False, skip_callee=True
                    ):
                        _emit(t, "index")
                        index_vars.add(t)

        # 2) size 슬롯 처리: sizeof(...) 내부도 USE로 집계
        if size_pos is not None and 0 <= size_pos < len(arg_nodes or []):
            size_arg = arg_nodes[size_pos]
            if isinstance(size_arg, dict):
                for t in self._idents_from_ast_node(
                    size_arg, skip_sizeof=False, skip_callee=True
                ):
                    _emit(t, "size")
                    size_vars.add(t)

        # 3) dst 슬롯 처리: 목적지(base) 표기 (필드 감도)
        if dst_pos is not None and 0 <= dst_pos < len(arg_nodes or []):
            dst_arg = arg_nodes[dst_pos]
            if isinstance(dst_arg, dict):
                for t in self._idents_from_ast_node(
                    dst_arg, skip_sizeof=True, skip_callee=True
                ):
                    _emit(t, "base")
                    base_vars.add(t)

        # 4) 나머지 인자들: value 표기
        for i, a in enumerate(arg_nodes or []):
            if not isinstance(a, dict):
                continue
            # ✅ dst/size 슬롯은 value 스캔에서 완전히 건너뜀 (중복 방지의 핵심)
            if i == dst_pos or i == size_pos:
                continue
            for t in self._idents_from_ast_node(a, skip_sizeof=True, skip_callee=True):
                # index/size/base로 이미 집계된 식별자는 value로 중복 집계하지 않음
                if t in index_vars or t in size_vars or t in base_vars:
                    continue
                _emit(t, "value")

        print(f"[_call_arg_uses_ast] fname={fname}, out(name,role)=({out})")

        return out

    def _call_write_effects_ast(
        self, fname: str, arg_nodes: List[Dict[str, Any]]
    ) -> List[str]:
        """
        호출의 '쓰기 효과(DEF)' 대상 식별자를 추출.
        - dst 인자(라이브러리별 위치)에 대해:
        * MemberAccess -> 'base.field' 풀네임으로 DEF
        * Identifier   -> 이름으로 DEF
        - scanf/fscanf: 포맷 이후 인자들에서 '&x' 패턴은 x를 DEF
        (필드 주소 &s.field 도 지원)
        - 중복 제거 및 KEYWORDS 제외
        """
        defs: List[str] = []

        def _emit(name: str | None):
            if name and name not in KEYWORDS and name not in defs:
                defs.append(name)

        def _first_ident(node: Dict[str, Any] | None) -> str:
            ids = self._idents_from_ast_node(node, skip_sizeof=True, skip_callee=True)
            return ids[0] if ids else ""

        def _dst_fullname(node: Dict[str, Any] | None) -> str:
            """dst가 MemberAccess면 풀네임, 아니면 첫 식별자."""
            if not isinstance(node, dict):
                return ""
            full = self._fullname_from_expr(node)  # 'base.field' or ident
            if full:
                return full
            return _first_ident(node)

        def _get_arg(idx: int) -> Dict[str, Any] | None:
            return (
                (arg_nodes or [None])[idx] if 0 <= idx < len(arg_nodes or []) else None
            )

        low = (fname or "").lower()

        # 1) 버퍼/문자열을 '목적지'로 쓰는 호출들: dst 슬롯 DEF
        #    (프로젝트 내 기존 맵핑과 일관)
        if low in {
            "memcpy",
            "memmove",
            "strcpy",
            "strcat",
            "strncpy",
            "snprintf",
            "sprintf",
            "vsnprintf",
            "vsprintf",
            "fgets",
            "gets",
        }:
            dst_idx = 0
            dst = _get_arg(dst_idx)
            _emit(_dst_fullname(dst))

        elif low in {"recv", "read", "getline"}:
            # recv(int, void* buf, size_t, ...) / read(int, void* buf, size_t)
            # getline(char** lineptr, size_t* n, FILE*): 프로젝트 기존 규칙에 따라 2번째 인자를 DEF로 취급
            dst_idx = 1
            dst = _get_arg(dst_idx)
            _emit(_dst_fullname(dst))

        # 2) scanf/fscanf: 포맷 이후 인자들에서 '&x' 주소 전달 → x DEF
        if low in {"scanf", "fscanf"}:
            # 인자 1 이후(포맷 다음)에서 &식별자 / &멤버 를 DEF로
            for a in (arg_nodes or [])[1:]:
                nm = self._extract_address_of_ident(a)  # 기존: &x 형태에서 x 추출
                if nm:
                    _emit(nm)
                    continue
                # 보강: &s.field 같은 케이스도 지원
                if isinstance(a, dict) and a.get("nodeType") in {
                    "UnaryOperator",
                    "UnaryExpression",
                }:
                    kids = a.get("children") or []
                    if kids:
                        full = self._fullname_from_expr(kids[0])  # & (MemberAccess)
                        _emit(full)

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

    def _lower_from_for_init(
        self, for_node: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """Detect lower-bound (x >= 0) evidence from ForStatement initializer like x = 0."""
        res: Dict[str, Dict[str, Any]] = {}
        kids = for_node.get("children") or []
        init = kids[0] if len(kids) >= 1 else None
        if isinstance(init, dict) and init.get("nodeType") == "AssignmentExpression":
            lhs, rhs = (init.get("children") or [None, None])[:2]
            if (
                isinstance(lhs, dict)
                and lhs.get("nodeType") == "Identifier"
                and isinstance(rhs, dict)
                and rhs.get("nodeType") == "Literal"
            ):
                nm = lhs.get("name")
                val = rhs.get("value")
                if isinstance(nm, str) and isinstance(val, str) and val.isdigit():
                    # assume non-negative literal as lower guard
                    if int(val) >= 0:
                        res[nm] = {"lower": 1, "upper": 0, "upper_const": 0.0}
        return res

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
            # Merge lower-bound from For init if applicable
            if (
                isinstance(src_orig, dict)
                and src_row.get("node_type_id", "") == "ForStatement"
            ):
                low = self._lower_from_for_init(src_orig)
                if low:
                    for k, v in low.items():
                        info.setdefault(k, {"lower": 0, "upper": 0, "upper_const": 0.0})
                        if v.get("lower"):
                            info[k]["lower"] = 1
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

    def _guard_ctx_by_sid(self, sid: int) -> dict:
        f = self._sid2feat.get(int(sid), {}) or {}
        # kind: 루프 안이면 2(while/for), 아니면 if(1) 또는 없음(0)
        kind = (
            2 if f.get("in_loop", 0) else (1 if f.get("ctx_guard_strength", 0) else 0)
        )
        s = int(f.get("ctx_guard_strength", 0) or 0)  # 0:none, 1:lower, 2:upper, 3:both
        return {
            "kind": kind,
            "lower": 1 if s in (1, 3) else 0,
            "upper": 1 if s in (2, 3) else 0,
            "upper_const": float(f.get("ctx_upper_bound_norm", 0.0) or 0.0),
        }
