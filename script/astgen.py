import json
import os
import re
import shutil
from collections import defaultdict
from dataclasses import dataclass
from multiprocessing import Pool, cpu_count
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from pycparser import c_ast, c_parser, parse_file
from tqdm import tqdm

# ─── Precompiled regex for splitting child names like "decl[0]" → "decl" ────
_CHILD_LIST_REGEX = re.compile(r"^(.+)\[\d+\]$")

# ─── Module‐level cache for one ASTGenerator per worker ─────────────────────
_cached_gen: Optional["ASTGenerator"] = None


# ─── WorkerConfig: bundled settings passed once to each pool worker ─────────
@dataclass(frozen=True)
class WorkerConfig:
    fake_paths: Set[str]
    cpp_args: List[str]
    cpp_path: str
    input_dir: str
    output_dir: str
    prune: bool
    generate_receipt: bool


# ─── Top-level factories (for multiprocessing picklability) ──────────────────
def _make_prop_set_dict() -> defaultdict:
    """Factory: node_type → (prop_name → set of type-strings)."""
    return defaultdict(set)


def _make_node_counts_dict() -> defaultdict:
    """Factory: node_type → how many times this node appeared."""
    return defaultdict(int)


def _make_prop_counts_inner() -> defaultdict:
    """Factory: prop_name → how many times that prop was present."""
    return defaultdict(int)


def _make_prop_counts_dict() -> defaultdict:
    """Factory: node_type → (prop_name → count)."""
    return defaultdict(_make_prop_counts_inner)


def _make_is_list_inner() -> defaultdict:
    """Factory: prop_name → bool (True if ever seen as a list)."""
    return defaultdict(bool)


def _make_is_list_dict() -> defaultdict:
    """Factory: node_type → (prop_name → bool)."""
    return defaultdict(_make_is_list_inner)


# ─── ASTGenerator Class ───────────────────────────────────────────────────────
class ASTGenerator:
    def __init__(
        self,
        input_dir: str = "src",
        output_dir: str = "ast_output",
        prune: bool = True,
        generate_receipt: bool = False,
    ):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.prune = prune
        self.generate_receipt = generate_receipt

        os.makedirs(self.output_dir, exist_ok=True)
        # parser is not used directly because parse_file builds its own
        self.parser = c_parser.CParser()

        fake_libc = "/home/keonoh/C-AST-Generator/script/fake_libc_include"
        support_dir = "/home/keonoh/C-AST-Generator/data/C/testcasesupport"
        self.fake_paths = {fake_libc, support_dir}

        self.cpp_args: List[str] = [
            "-E",
            "-std=c99",
            "-nostdinc",
            f"-I{fake_libc}",
            f"-I{support_dir}",
        ]
        self.cpp_path = "gcc"

    @staticmethod
    def _process_file(
        args: Tuple[str, WorkerConfig],
    ) -> Tuple[
        Optional[str],
        Dict[str, Dict[str, List[str]]],
        Dict[str, int],
        Dict[str, Dict[str, int]],
        Dict[str, Dict[str, bool]],
    ]:
        """
        Returns:
          - err_msg or None
          - sample_types: nodeType → (propName → sorted list of type-strings)
          - node_counts:  nodeType → count of occurrences
          - prop_counts:  nodeType → (propName → how many nodes had that prop)
          - is_list:      nodeType → (propName → True if ever seen as a list)
        """
        infile, cfg = args

        # Cache a single ASTGenerator per worker process
        global _cached_gen
        if _cached_gen is None:
            _cached_gen = ASTGenerator(
                input_dir=cfg.input_dir,
                output_dir=cfg.output_dir,
                prune=cfg.prune,
                generate_receipt=cfg.generate_receipt,
            )
            _cached_gen.fake_paths = cfg.fake_paths
            _cached_gen.cpp_args = cfg.cpp_args
            _cached_gen.cpp_path = cfg.cpp_path

        gen = _cached_gen

        # Always copy the original source file into the output directory
        rel_dir = gen._get_save_path(infile)
        fname = os.path.basename(infile)
        original = os.path.join(rel_dir, fname)
        shutil.copy2(infile, original)

        ast_file = os.path.join(rel_dir, fname + ".ast")
        json_file = os.path.join(rel_dir, fname + ".json")

        try:
            ast = gen._parse_ast(infile)
        except Exception as e:
            return f"{infile}: {e}", {}, {}, {}, {}

        # On success, write AST text and JSON
        gen._save_ast(ast, ast_file)
        gen.ast_to_json(ast, json_file)

        # Prepare accumulators for receipt generation
        samples: Dict[str, Dict[str, set]] = defaultdict(_make_prop_set_dict)
        node_counts: Dict[str, int] = _make_node_counts_dict()
        prop_counts: Dict[str, Dict[str, int]] = _make_prop_counts_dict()
        is_list: Dict[str, Dict[str, bool]] = defaultdict(_make_is_list_inner)

        if cfg.generate_receipt:

            def _traverse(node: Any) -> None:
                if not isinstance(node, c_ast.Node):
                    return

                nt = node.__class__.__name__
                node_counts[nt] += 1

                # ─── Handle attributes in attr_names ──────────────────────
                for attr_name in getattr(node, "attr_names", []) or []:
                    value = getattr(node, attr_name)
                    prop_counts[nt][attr_name] += 1

                    if isinstance(value, c_ast.Node):
                        samples[nt][attr_name].add(value.__class__.__name__)

                    elif isinstance(value, list):
                        is_list[nt][attr_name] = True
                        for element in value:
                            if isinstance(element, c_ast.Node):
                                samples[nt][attr_name].add(element.__class__.__name__)
                            else:
                                samples[nt][attr_name].add(type(element).__name__)

                    else:
                        samples[nt][attr_name].add(type(value).__name__)

                # ─── Handle children from node.children() ───────────────
                child_bucket: Dict[str, List[c_ast.Node]] = defaultdict(list)
                for child_name, child_node in node.children() or []:
                    m = _CHILD_LIST_REGEX.match(child_name)
                    prop_key = m.group(1) if m else child_name
                    child_bucket[prop_key].append(child_node)

                for prop_key, nodes_list in child_bucket.items():
                    prop_counts[nt][prop_key] += 1
                    if len(nodes_list) > 1:
                        is_list[nt][prop_key] = True

                    for child_node in nodes_list:
                        samples[nt][prop_key].add(child_node.__class__.__name__)
                        _traverse(child_node)

            _traverse(ast)

        # Convert each inner set → sorted list
        final_samples: Dict[str, Dict[str, List[str]]] = {
            nt: {prop: sorted(types_set) for prop, types_set in prop_map.items()}
            for nt, prop_map in samples.items()
        }

        return (
            None,
            final_samples,
            dict(node_counts),
            {nt: dict(prop_map) for nt, prop_map in prop_counts.items()},
            {nt: dict(prop_map) for nt, prop_map in is_list.items()},
        )

    def generate_all(self) -> None:
        # ─── Phase A: Build a single WorkerConfig and task list ──────────
        cfg = WorkerConfig(
            fake_paths=self.fake_paths,
            cpp_args=self.cpp_args,
            cpp_path=self.cpp_path,
            input_dir=self.input_dir,
            output_dir=self.output_dir,
            prune=self.prune,
            generate_receipt=self.generate_receipt,
        )

        tasks: List[Tuple[str, WorkerConfig]] = []
        for root, _, files in os.walk(self.input_dir):
            for fname in files:
                if fname.endswith((".c", ".h")):
                    path = os.path.join(root, fname)
                    tasks.append((path, cfg))

        # ─── Phase B: Initialize combined accumulators ────────────────────
        combined: Dict[str, Dict[str, set]] = defaultdict(_make_prop_set_dict)
        combined_node_counts: Dict[str, int] = _make_node_counts_dict()
        combined_prop_counts: Dict[str, Dict[str, int]] = _make_prop_counts_dict()
        combined_is_list: Dict[str, Dict[str, bool]] = _make_is_list_dict()

        error_log = open(os.path.join(self.output_dir, "error.log"), "w+")

        total_tasks = len(tasks)
        chunksize = max(1, total_tasks // (cpu_count() * 4))

        # ─── Use apply_async + callback to update tqdm immediately ─────────
        with Pool(cpu_count()) as pool:
            with tqdm(total=total_tasks, desc="Processing files", unit="file") as pbar:

                def _merge_result(result_tuple):
                    err, sample_types, node_counts, prop_counts, is_list_flags = (
                        result_tuple
                    )

                    if err:
                        error_log.write(err + "\n")

                    # ─── Merge sample types ───────────────────────────────
                    for nt, prop_map in sample_types.items():
                        for prop_name, types_list in prop_map.items():
                            combined[nt][prop_name].update(types_list)

                    # ─── Merge node_counts ───────────────────────────────
                    for nt, count in node_counts.items():
                        combined_node_counts[nt] += count

                    # ─── Merge prop_counts ───────────────────────────────
                    for nt, prop_map in prop_counts.items():
                        for prop_name, count in prop_map.items():
                            combined_prop_counts[nt][prop_name] += count

                    # ─── Merge is_list ───────────────────────────────────
                    for nt, prop_map in is_list_flags.items():
                        for prop_name, was_list in prop_map.items():
                            if was_list:
                                combined_is_list[nt][prop_name] = True

                    # Advance the progress bar by one file
                    pbar.update()

                # Submit each task to the pool
                for task in tasks:
                    pool.apply_async(
                        ASTGenerator._process_file, args=(task,), callback=_merge_result
                    )

                pool.close()
                pool.join()

        # ─── Phase C: Optionally generate receipt JSON and TypeScript  ───
        if self.generate_receipt:
            # ─── Write combined_receipt.json ────────────────────────────
            json_receipt_file = os.path.join(self.output_dir, "combined_receipt.json")
            receipt_dict: Dict[str, Dict[str, List[str]]] = {
                nt: {
                    prop_name: sorted(list(type_set))
                    for prop_name, type_set in prop_map.items()
                }
                for nt, prop_map in combined.items()
            }
            with open(json_receipt_file, "w") as f:
                json.dump(receipt_dict, f, indent=2)

            # ─── Build “schema” per node type ────────────────────────────
            schema: Dict[
                str,
                Dict[
                    str,
                    Union[
                        int,
                        Dict[str, List[str]],  # primitive_props
                        Dict[str, List[str]],  # child_props
                    ],
                ],
            ] = {}

            def python_to_json_ts(typename: str) -> str:
                mapping = {
                    "str": "string",
                    "int": "number",
                    "float": "number",
                    "bool": "boolean",
                    "NoneType": "null",
                }
                return mapping.get(typename, "unknown")

            # 1) Build initial schema entries for every defined node type
            for nt, prop_map in combined.items():
                primitive_props: Dict[str, List[str]] = {}
                child_props: Dict[str, List[str]] = {}
                total_count = combined_node_counts.get(nt, 0)

                for prop_name, types_set in prop_map.items():
                    json_types: List[str] = []
                    node_types: List[str] = []

                    for t in sorted(types_set):
                        mapped = python_to_json_ts(t)
                        if mapped != "unknown":
                            json_types.append(mapped)
                        else:
                            node_types.append(t)

                    if json_types:
                        primitive_props[prop_name] = sorted(set(json_types))
                    if node_types:
                        child_props[prop_name] = sorted(set(node_types))

                schema[nt] = {
                    "primitive_props": primitive_props,
                    "child_props": child_props,
                    "total_count": total_count,
                }

            # 2) Find any referenced child‐node types not in schema (leaf stubs)
            all_defined = set(schema.keys())
            all_referenced: Set[str] = set()
            for info in schema.values():
                child_props: Dict[str, List[str]] = info["child_props"]  # type: ignore
                for node_list in child_props.values():
                    all_referenced.update(node_list)

            missing = sorted(all_referenced - all_defined)
            for leaf in missing:
                # Add a stub schema entry with no props (total_count = 0)
                schema[leaf] = {
                    "primitive_props": {},
                    "child_props": {},
                    "total_count": 0,
                }

            # ─── Emit combined_receipt.ts ────────────────────────────────
            ts_receipt_file = os.path.join(self.output_dir, "combined_receipt.ts")
            print("Writing TypeScript receipt to", ts_receipt_file)

            lines: List[str] = []
            lines.append("/* Auto-generated AST Receipt (TypeScript, matching JSON) */")
            lines.append("")

            for nt, info in schema.items():
                interface_name = f"{nt}Node"
                primitive_props: Dict[str, List[str]] = info["primitive_props"]  # type: ignore
                child_props: Dict[str, List[str]] = info["child_props"]  # type: ignore
                total_count: int = info["total_count"]  # type: ignore

                lines.append(f"export interface {interface_name} {{")
                # 1) Discriminated literal
                lines.append(f'  _nodetype: "{nt}";')

                # 2) Emit a nested `children` block if there are any child props
                if child_props:
                    lines.append("  children?: {")
                    for prop_name, node_types in child_props.items():
                        present_count = combined_prop_counts[nt].get(prop_name, 0)
                        optional_marker = "?" if present_count < total_count else ""
                        was_list = combined_is_list[nt].get(prop_name, False)

                        mapped_node_types = [f"{child}Node" for child in node_types]
                        union_inner = " | ".join(mapped_node_types)

                        if was_list:
                            ts_type = f"Array<{union_inner}>"
                        else:
                            ts_type = union_inner

                        lines.append(f"    {prop_name}{optional_marker}: {ts_type};")
                    lines.append("  };")

                # 3) Emit each primitive prop at the top level
                for prop_name, json_types in primitive_props.items():
                    present_count = combined_prop_counts[nt].get(prop_name, 0)
                    optional_marker = "?" if present_count < total_count else ""
                    was_list = combined_is_list[nt].get(prop_name, False)

                    if was_list:
                        union_inner = " | ".join(json_types)
                        ts_type = f"Array<{union_inner}>"
                    else:
                        ts_type = " | ".join(json_types)

                    lines.append(f"  {prop_name}{optional_marker}: {ts_type};")

                lines.append("}")
                lines.append("")

            # 3) Emit the union of all node interfaces (including leaf stubs)
            all_interfaces = [f"{nt}Node" for nt in schema.keys()]
            union_alias = " | ".join(all_interfaces)
            lines.append(f"export type ASTNodeJSON = {union_alias};")
            lines.append("")

            with open(ts_receipt_file, "w") as ts_f:
                ts_f.write("\n".join(lines))

            print("TypeScript receipt written to", ts_receipt_file)

    def _parse_ast(self, path: str) -> c_ast.FileAST:
        ast = parse_file(
            filename=path,
            use_cpp=True,
            cpp_path=self.cpp_path,
            cpp_args=self.cpp_args,  # type: ignore
        )
        if self.prune:
            self._prune_ast_nodes(ast)
        return ast

    def _save_ast(self, ast: c_ast.FileAST, out_path: str) -> None:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w") as f:
            ast.show(buf=f)

    def ast_to_json(self, ast: c_ast.FileAST, output_file: str) -> None:
        ast_dict = self._node_to_dict(ast)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(ast_dict, f, indent=2)

    def _prune_ast_nodes(self, node: c_ast.Node) -> None:
        if not isinstance(node, c_ast.Node):
            return
        list_kept: dict[str, List[c_ast.Node]] = {}
        single_drop: set[str] = set()
        for child_name, child in node.children() or []:
            m = _CHILD_LIST_REGEX.match(child_name)
            coord = getattr(child, "coord", None)
            path = getattr(coord, "file", "") or ""
            if m:
                base = m.group(1)
                list_kept.setdefault(base, [])
                if not any(path.startswith(fp) for fp in self.fake_paths):
                    self._prune_ast_nodes(child)
                    list_kept[base].append(child)
            else:
                base = child_name
                if any(path.startswith(fp) for fp in self.fake_paths):
                    single_drop.add(base)
                else:
                    self._prune_ast_nodes(child)
        for base, new_list in list_kept.items():
            setattr(node, base, new_list)
        for base in single_drop:
            setattr(node, base, None)

    def _node_to_dict(self, node: Any) -> Any:
        if not isinstance(node, c_ast.Node):
            return node
        result: dict[str, Any] = {"_nodetype": node.__class__.__name__}
        for attr in getattr(node, "attr_names", []) or []:
            result[attr] = getattr(node, attr)
        children: dict[str, list[Any]] = {}
        for child_name, child in node.children() or []:
            m = _CHILD_LIST_REGEX.match(child_name)
            key = m.group(1) if m else child_name
            children.setdefault(key, []).append(self._node_to_dict(child))
        if children:
            result["children"] = children
        return result

    def _get_save_path(self, path: str) -> str:
        rel = os.path.relpath(path, self.input_dir)
        if os.path.splitext(rel)[1]:
            rel = os.path.dirname(rel)
        out_dir = os.path.join(self.output_dir, rel)
        os.makedirs(out_dir, exist_ok=True)
        return out_dir


if __name__ == "__main__":
    gen = ASTGenerator(
        input_dir="/home/keonoh/C-AST-Generator/data/C/testcases",
        output_dir="ast_output",
        prune=True,
        generate_receipt=True,
    )
    gen.generate_all()
