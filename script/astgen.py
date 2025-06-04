#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from multiprocessing import Pool, cpu_count
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from pycparser import c_ast, c_parser, parse_file
from tqdm import tqdm

# ─── Increase recursion limit to avoid deep AST RecursionError ─────────────
sys.setrecursionlimit(10_000)

# ─── Precompiled regex for splitting child names like "decl[0]" → "decl" ───
_CHILD_LIST_REGEX = re.compile(r"^(.+)\[\d+\]$")

# ─── Module‐level cache for one ASTGenerator per worker ────────────────────
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


# ─── Top‐level factories (for multiprocessing picklability) ─────────────────
def _make_prop_set_dict() -> defaultdict:
    """Factory: node_type → (prop_name → set of type‐strings)."""
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


def _make_list_max_inner() -> defaultdict:
    """Factory: prop_name → maximum length seen for that list."""
    return defaultdict(int)


def _make_list_max_dict() -> defaultdict:
    """Factory: node_type → (prop_name → max length int)."""
    return defaultdict(_make_list_max_inner)


def _make_is_list_inner() -> defaultdict:
    """Factory: prop_name → bool (True if ever seen as a list)."""
    return defaultdict(bool)


def _make_is_list_dict() -> defaultdict:
    """Factory: node_type → (prop_name → bool)."""
    return defaultdict(_make_is_list_inner)


# ─── ASTGenerator Class ────────────────────────────────────────────────────
class ASTGenerator:
    def __init__(
        self,
        input_dir: str = "/home/keonoh/C-AST-Generator/data/C/testcases",
        output_dir: str = "ast_output",
        prune: bool = True,
        generate_receipt: bool = True,
        typescript: bool = True,
    ):
        """
        - input_dir: directory to scan for .c/.h files
        - output_dir: where .ast and .json (and TS receipt, if requested) go
        - prune: whether to prune fake‐libc nodes out of the AST
        - generate_receipt: if True, produce combined_receipt.json and cache
        - typescript:      if True, produce combined_receipt.ts
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.prune = prune
        self.generate_receipt = generate_receipt
        self.typescript = typescript

        os.makedirs(self.output_dir, exist_ok=True)
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

    def _get_save_path(self, path: str) -> str:
        rel = os.path.relpath(path, self.input_dir)
        if os.path.splitext(rel)[1]:
            rel = os.path.dirname(rel)
        out_dir = os.path.join(self.output_dir, rel)
        os.makedirs(out_dir, exist_ok=True)
        return out_dir

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
        list_kept: Dict[str, List[c_ast.Node]] = {}
        single_drop: Set[str] = set()
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

        result: Dict[str, Any] = {"_nodetype": node.__class__.__name__}
        for attr in getattr(node, "attr_names", []) or []:
            result[attr] = getattr(node, attr)

        raw_children: Dict[str, List[Any]] = defaultdict(list)
        for child_name, child in node.children() or []:
            m = _CHILD_LIST_REGEX.match(child_name)
            key = m.group(1) if m else child_name

            child_dict = self._node_to_dict(child)

            if isinstance(child_dict, dict) and "_nodetype" not in child_dict:
                prim_key = f"{key}__primitive"
                existing = result.get(prim_key)
                if existing is None:
                    result[prim_key] = child_dict
                else:
                    if not isinstance(existing, list):
                        result[prim_key] = [existing]
                    result[prim_key].append(child_dict)
                continue

            raw_children[key].append(child_dict)

        if raw_children:
            flattened: Dict[str, Union[Any, List[Any]]] = {}
            for key, lst in raw_children.items():
                if len(lst) == 1:
                    flattened[key] = lst[0]
                else:
                    flattened[key] = lst
            result["children"] = flattened

        return result

    @staticmethod
    def _process_file(
        args: Tuple[str, WorkerConfig],
    ) -> Tuple[
        Optional[str],
        Dict[str, Dict[str, List[str]]],
        Dict[str, int],
        Dict[str, Dict[str, int]],
        Dict[str, Dict[str, int]],
        Dict[str, Dict[str, bool]],
    ]:
        """
        Returns:
          - err_msg or None
          - sample_types: nodeType → (propName → sorted list of type‐strings)
          - node_counts:  nodeType → count of occurrences
          - prop_counts:  nodeType → (propName → how many nodes had that prop)
          - list_max:     nodeType → (propName → max length seen for that list)
          - is_list:      nodeType → (propName → True if ever seen as a list)
        """
        infile, cfg = args

        global _cached_gen
        if _cached_gen is None:
            _cached_gen = ASTGenerator(
                input_dir=cfg.input_dir,
                output_dir=cfg.output_dir,
                prune=cfg.prune,
                generate_receipt=cfg.generate_receipt,
                typescript=False,  # TS not needed in worker
            )
            _cached_gen.fake_paths = cfg.fake_paths
            _cached_gen.cpp_args = cfg.cpp_args
            _cached_gen.cpp_path = cfg.cpp_path

        gen = _cached_gen
        rel_dir = gen._get_save_path(infile)
        fname = os.path.basename(infile)
        original = os.path.join(rel_dir, fname)
        shutil.copy2(infile, original)

        ast_file = os.path.join(rel_dir, fname + ".ast")
        json_file = os.path.join(rel_dir, fname + ".json")

        try:
            ast = gen._parse_ast(infile)
        except Exception as e:
            return f"{infile}: {e}", {}, {}, {}, {}, {}

        gen._save_ast(ast, ast_file)
        gen.ast_to_json(ast, json_file)

        samples: Dict[str, Dict[str, set]] = defaultdict(_make_prop_set_dict)
        node_counts: Dict[str, int] = _make_node_counts_dict()
        prop_counts: Dict[str, Dict[str, int]] = _make_prop_counts_dict()
        list_max: Dict[str, Dict[str, int]] = _make_list_max_dict()
        is_list: Dict[str, Dict[str, bool]] = defaultdict(_make_is_list_inner)

        if cfg.generate_receipt:

            def _traverse(node: Any) -> None:
                if not isinstance(node, c_ast.Node):
                    return

                nt = node.__class__.__name__
                node_counts[nt] += 1

                for attr_name in getattr(node, "attr_names", []) or []:
                    value = getattr(node, attr_name)
                    prop_counts[nt][attr_name] += 1

                    if isinstance(value, c_ast.Node):
                        samples[nt][attr_name].add(value.__class__.__name__)
                    elif isinstance(value, list):
                        is_list[nt][attr_name] = True
                        length = len(value)
                        list_max[nt][attr_name] = max(list_max[nt][attr_name], length)
                        if length == 0:
                            samples[nt][attr_name].add("str")
                        else:
                            for element in value:
                                if isinstance(element, c_ast.Node):
                                    samples[nt][attr_name].add(
                                        element.__class__.__name__
                                    )
                                else:
                                    samples[nt][attr_name].add(type(element).__name__)
                    else:
                        samples[nt][attr_name].add(type(value).__name__)

                child_bucket: Dict[str, List[c_ast.Node]] = defaultdict(list)
                for child_name, child_node in node.children() or []:
                    m = _CHILD_LIST_REGEX.match(child_name)
                    prop_key = m.group(1) if m else child_name
                    child_bucket[prop_key].append(child_node)

                for prop_key, nodes_list in child_bucket.items():
                    prop_counts[nt][prop_key] += 1
                    count = len(nodes_list)
                    if count > 1:
                        is_list[nt][prop_key] = True
                    list_max[nt][prop_key] = max(list_max[nt][prop_key], count)

                    for child_node in nodes_list:
                        samples[nt][prop_key].add(child_node.__class__.__name__)
                        _traverse(child_node)

            _traverse(ast)

        final_samples: Dict[str, Dict[str, List[str]]] = {
            nt: {prop: sorted(types_set) for prop, types_set in prop_map.items()}
            for nt, prop_map in samples.items()
        }

        return (
            None,
            final_samples,
            dict(node_counts),
            {nt: dict(prop_map) for nt, prop_map in prop_counts.items()},
            {nt: dict(prop_map) for nt, prop_map in list_max.items()},
            {nt: dict(prop_map) for nt, prop_map in is_list.items()},
        )

    def generate_all(self, cache_path: Optional[str] = None) -> None:
        """
        If cache_path is provided, load combined data from that JSON file.
        Otherwise, parse all .c/.h files to build combined data, then cache if requested.
        Finally, generate receipt JSON and/or TypeScript depending on flags.
        """
        if cache_path:
            with open(cache_path, "r") as cf:
                data = json.load(cf)

            loaded_combined: Dict[str, Dict[str, List[str]]] = {
                nt: {
                    prop_name: types_list for prop_name, types_list in prop_map.items()
                }
                for nt, prop_map in data.get("combined_props", {}).items()
            }
            loaded_node_counts = {
                nt: count for nt, count in data.get("node_counts", {}).items()
            }
            loaded_prop_counts = {
                nt: {prop: cnt for prop, cnt in prop_map.items()}
                for nt, prop_map in data.get("prop_counts", {}).items()
            }
            loaded_list_max = {
                nt: {prop: mx for prop, mx in prop_map.items()}
                for nt, prop_map in data.get("list_max", {}).items()
            }
            loaded_is_list = {
                nt: {prop: flag for prop, flag in prop_map.items()}
                for nt, prop_map in data.get("is_list", {}).items()
            }

            if self.generate_receipt:
                json_receipt_file = os.path.join(
                    self.output_dir, "combined_receipt.json"
                )
                with open(json_receipt_file, "w") as f:
                    json.dump(loaded_combined, f, indent=2)

            if self.typescript:
                self._generate_typescript(
                    loaded_combined,
                    loaded_node_counts,
                    loaded_prop_counts,
                    loaded_list_max,
                    loaded_is_list,
                )
            return

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

        parsed_combined: Dict[str, Dict[str, set]] = defaultdict(_make_prop_set_dict)
        parsed_node_counts: Dict[str, int] = _make_node_counts_dict()
        parsed_prop_counts: Dict[str, Dict[str, int]] = _make_prop_counts_dict()
        parsed_list_max: Dict[str, Dict[str, int]] = _make_list_max_dict()
        parsed_is_list: Dict[str, Dict[str, bool]] = _make_is_list_dict()

        error_log_path = os.path.join(self.output_dir, "error.log")
        with open(error_log_path, "w+") as error_log:
            total_tasks = len(tasks)
            chunksize = max(1, total_tasks // (cpu_count() * 4))

            with Pool(cpu_count()) as pool:
                with tqdm(
                    total=total_tasks, desc="Processing files", unit="file"
                ) as pbar:

                    def _merge_result(result_tuple):
                        (
                            err,
                            sample_types,
                            node_counts,
                            prop_counts,
                            list_max,
                            is_list_flags,
                        ) = result_tuple

                        if err:
                            error_log.write(err + "\n")

                        for nt, prop_map in sample_types.items():
                            for prop_name, types_list in prop_map.items():
                                parsed_combined[nt][prop_name].update(types_list)

                        for nt, count in node_counts.items():
                            parsed_node_counts[nt] += count

                        for nt, prop_map in prop_counts.items():
                            for prop_name, count in prop_map.items():
                                parsed_prop_counts[nt][prop_name] += count

                        for nt, prop_map in list_max.items():
                            for prop_name, length in prop_map.items():
                                parsed_list_max[nt][prop_name] = max(
                                    parsed_list_max[nt].get(prop_name, 0),
                                    length,
                                )

                        for nt, prop_map in is_list_flags.items():
                            for prop_name, was_list in prop_map.items():
                                if was_list:
                                    parsed_is_list[nt][prop_name] = True

                        pbar.update()

                    for task in tasks:
                        pool.apply_async(
                            ASTGenerator._process_file,
                            args=(task,),
                            callback=_merge_result,
                        )

                    pool.close()
                    pool.join()

        combined_props: Dict[str, Dict[str, List[str]]] = {
            nt: {prop: sorted(types_set) for prop, types_set in prop_map.items()}
            for nt, prop_map in parsed_combined.items()
        }

        cache_file = os.path.join(self.output_dir, "receipt_data.json")
        if self.generate_receipt:
            json_receipt_file = os.path.join(self.output_dir, "combined_receipt.json")
            with open(json_receipt_file, "w") as f:
                json.dump(combined_props, f, indent=2)

            cache_data = {
                "combined_props": combined_props,
                "node_counts": parsed_node_counts,
                "prop_counts": parsed_prop_counts,
                "list_max": parsed_list_max,
                "is_list": parsed_is_list,
            }
            with open(cache_file, "w") as cf:
                json.dump(cache_data, cf, indent=2)

        if self.typescript:
            self._generate_typescript(
                combined_props,
                parsed_node_counts,
                parsed_prop_counts,
                parsed_list_max,
                parsed_is_list,
            )

    def _generate_typescript(
        self,
        schema_combined: Dict[str, Dict[str, List[str]]],
        schema_node_counts: Dict[str, int],
        schema_prop_counts: Dict[str, Dict[str, int]],
        schema_list_max: Dict[str, Dict[str, int]],
        schema_is_list: Dict[str, Dict[str, bool]],
    ) -> None:
        """
        Emits combined_receipt.ts, copies to RawNodes.ts, then runs ESLint --fix on RawNodes.ts.
        """

        def python_to_json_ts(typename: str) -> str:
            mapping = {
                "str": "string",
                "int": "number",
                "float": "number",
                "bool": "boolean",
                "NoneType": "null",
            }
            return mapping.get(typename, "unknown")

        ts_schema: Dict[str, Dict[str, Any]] = {}
        for nt, prop_map in schema_combined.items():
            primitive_props: Dict[str, List[str]] = {}
            child_props: Dict[str, List[str]] = {}
            raw_count = schema_node_counts.get(nt, 0)
            total_count = raw_count if isinstance(raw_count, int) else 0

            for prop_name, types_list in prop_map.items():
                json_types: List[str] = []
                node_types: List[str] = []
                for t in sorted(types_list, key=str.lower):
                    mapped = python_to_json_ts(t)
                    if mapped != "unknown":
                        json_types.append(mapped)
                    else:
                        node_types.append(t)
                if json_types:
                    primitive_props[prop_name] = sorted(set(json_types))
                if node_types:
                    child_props[prop_name] = sorted(set(node_types))

            ts_schema[nt] = {
                "primitive_props": primitive_props,
                "child_props": child_props,
                "total_count": total_count,
            }

        # Ensure every referenced child node is present
        all_defined = set(ts_schema.keys())
        all_referenced: Set[str] = set()
        for info in ts_schema.values():
            child_dict = info.get("child_props")
            if isinstance(child_dict, dict):
                for node_list in child_dict.values():
                    if isinstance(node_list, list):
                        all_referenced.update(node_list)

        missing = sorted(all_referenced - all_defined, key=str.lower)
        for leaf in missing:
            ts_schema[leaf] = {
                "primitive_props": {},
                "child_props": {},
                "total_count": 0,
            }

        ts_receipt_file = os.path.join(self.output_dir, "combined_receipt.ts")
        print("Writing TypeScript receipt to", ts_receipt_file)

        lines: List[str] = []

        # Emit enum of node types (unsorted, ESLint will reorder)
        lines.append("export enum RawASTNodeTypes {")
        for nt in ts_schema:
            lines.append(f'  {nt} = "{nt}",')
        lines.append("}")
        lines.append("")

        # Emit interfaces in simple insertion order
        for nt, info in ts_schema.items():
            primitive_props = info.get("primitive_props", {}) or {}
            child_props = info.get("child_props", {}) or {}
            total_count = info.get("total_count", 0) or 0

            interface_name = f"IRaw{nt}Node"
            lines.append(f"export interface {interface_name} {{")
            lines.append(f'  _nodetype: "{nt}";')

            # Gather prop keys in insertion order
            prop_keys: List[str] = []
            if child_props:
                prop_keys.append("children")
            prop_keys.extend(primitive_props.keys())

            for prop_name in prop_keys:
                if prop_name == "children":
                    lines.append("  children?: {")
                    for child_prop, node_list in child_props.items():
                        raw_present = (
                            schema_prop_counts.get(nt, {}).get(child_prop, 0) or 0
                        )
                        present_count = raw_present
                        optional_marker = "?" if present_count < total_count else ""
                        was_list = (
                            schema_is_list.get(nt, {}).get(child_prop, False) or False
                        )
                        max_len = schema_list_max.get(nt, {}).get(child_prop, 0) or 0

                        mapped_node_types = [f"IRaw{child}Node" for child in node_list]
                        union_inner = " | ".join(mapped_node_types)
                        ts_type = (
                            f"{union_inner}[]"
                            if was_list and max_len > 1
                            else union_inner
                        )

                        lines.append(f"    {child_prop}{optional_marker}: {ts_type};")
                    lines.append("  };")
                else:
                    json_types = primitive_props.get(prop_name, []) or []
                    raw_present = schema_prop_counts.get(nt, {}).get(prop_name, 0) or 0
                    present_count = raw_present
                    optional_marker = "?" if present_count < total_count else ""
                    was_list = schema_is_list.get(nt, {}).get(prop_name, False) or False
                    max_len = schema_list_max.get(nt, {}).get(prop_name, 0) or 0

                    if was_list and max_len > 1:
                        union_inner = " | ".join(json_types)
                        ts_type = f"{union_inner}[]"
                    else:
                        ts_type = " | ".join(json_types)

                    lines.append(f"  {prop_name}{optional_marker}: {ts_type};")

            lines.append("}")
            lines.append("")

        # Emit union alias at the end
        interface_names = [f"IRaw{n}Node" for n in ts_schema]
        lines.append(f"export type RawASTNodeJSON = {' | '.join(interface_names)};")
        lines.append("")

        with open(ts_receipt_file, "w") as ts_f:
            ts_f.write("\n".join(lines))

        print("TypeScript receipt written to", ts_receipt_file)

        # Copy to destination first
        dest_path = os.path.normpath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "src",
                "types",
                "ASTNodes",
                "RawNodes.ts",
            )
        )
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)

        if os.path.exists(dest_path):
            print(f"Overwriting existing TypeScript receipt at {dest_path}")

        shutil.copy2(ts_receipt_file, dest_path)
        print(f"Copied TypeScript receipt to {dest_path}")

        # Run ESLint --fix on the copied file
        subprocess.run(["npx", "eslint", "--fix", dest_path], check=False)


if __name__ == "__main__":
    gen = ASTGenerator(
        input_dir="/home/keonoh/C-AST-Generator/data/C/testcases",
        output_dir="ast_output",
        prune=True,
        generate_receipt=True,  # Writes combined_receipt.json and receipt_data.json
        typescript=True,  # Writes combined_receipt.ts and copies it
    )
    gen.generate_all(
        cache_path="/home/keonoh/C-AST-Generator/ast_output/receipt_data.json"
    )
