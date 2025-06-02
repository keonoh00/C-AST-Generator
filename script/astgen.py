import json
import os
import re
import shutil
from collections import defaultdict
from multiprocessing import Pool, cpu_count
from typing import Any, Dict, List, Optional, Tuple

from pycparser import c_ast, c_parser, parse_file
from tqdm import tqdm

# ─── Top-level factories (for multiprocessing picklability) ───────────────────


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
        args: Tuple[str, str, str, str, List[str], bool, bool],
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
          - sample_types: nodeType → (propName → sorted list of type-strings)
          - node_counts:  nodeType → count of occurrences
          - prop_counts:  nodeType → (propName → how many nodes had that prop)
          - list_max:     nodeType → (propName → maximum length seen if it was a list)
          - is_list:      nodeType → (propName → True if ever seen as a list)
        """
        infile, input_dir, output_dir, cpp_path, cpp_args, prune, generate_receipt = (
            args
        )
        gen = ASTGenerator(
            input_dir=input_dir,
            output_dir=output_dir,
            prune=prune,
            generate_receipt=generate_receipt,
        )
        gen.cpp_path = cpp_path
        gen.cpp_args = cpp_args

        rel_dir = gen._get_save_path(infile)
        fname = os.path.basename(infile)
        original = os.path.join(rel_dir, fname)
        ast_file = os.path.join(rel_dir, fname + ".ast")
        json_file = os.path.join(rel_dir, fname + ".json")

        shutil.copy2(infile, original)
        try:
            ast = gen._parse_ast(infile)
        except Exception as e:
            return f"{infile}: {e}", {}, {}, {}, {}, {}

        gen._save_ast(ast, ast_file)
        gen.ast_to_json(ast, json_file)

        # 1) samples: nodeType → (propName → set of type-strings)
        samples: Dict[str, Dict[str, set]] = defaultdict(_make_prop_set_dict)
        # 2) node_counts: nodeType → int
        node_counts: Dict[str, int] = _make_node_counts_dict()
        # 3) prop_counts: nodeType → (propName → int)
        prop_counts: Dict[str, Dict[str, int]] = _make_prop_counts_dict()
        # 4) list_max: nodeType → (propName → max length of list)
        list_max: Dict[str, Dict[str, int]] = _make_list_max_dict()
        # 5) is_list: nodeType → (propName → bool)
        is_list: Dict[str, Dict[str, bool]] = _make_is_list_dict()

        if gen.generate_receipt:

            def _traverse(node: Any) -> None:
                if not isinstance(node, c_ast.Node):
                    return

                nt = node.__class__.__name__
                node_counts[nt] += 1

                # ─── Handle attributes in attr_names ─────────────────────────────
                for attr_name in getattr(node, "attr_names", []) or []:
                    value = getattr(node, attr_name)
                    prop_counts[nt][attr_name] += 1  # presence on this node

                    if isinstance(value, c_ast.Node):
                        # single child
                        tname = value.__class__.__name__
                        samples[nt][attr_name].add(tname)

                    elif isinstance(value, list):
                        # mark as list
                        is_list[nt][attr_name] = True
                        L = len(value)
                        list_max[nt][attr_name] = max(list_max[nt][attr_name], L)

                        # if empty, record presence but no types
                        if L == 0:
                            continue
                        for element in value:
                            if isinstance(element, c_ast.Node):
                                samples[nt][attr_name].add(element.__class__.__name__)
                            else:
                                samples[nt][attr_name].add(type(element).__name__)

                    else:
                        # primitive (str/int/float/bool/NoneType/etc.)
                        samples[nt][attr_name].add(type(value).__name__)

                # ─── Handle children from node.children() ───────────────────────
                # First, collect all children under each prop_key:
                child_bucket: Dict[str, List[c_ast.Node]] = defaultdict(list)
                for child_name, child_node in node.children() or []:
                    m = re.match(r"^(.+)\[\d+\]$", child_name)
                    prop_key = m.group(1) if m else child_name
                    child_bucket[prop_key].append(child_node)

                # Now process each prop_key once
                for prop_key, nodes_list in child_bucket.items():
                    prop_counts[nt][prop_key] += 1  # property present on this node
                    count = len(nodes_list)
                    if count > 1:
                        is_list[nt][prop_key] = True
                    list_max[nt][prop_key] = max(list_max[nt][prop_key], count)

                    for child_node in nodes_list:
                        tname = child_node.__class__.__name__
                        samples[nt][prop_key].add(tname)
                        _traverse(child_node)

            _traverse(ast)

        # Convert each inner set → sorted list
        final_samples: Dict[str, Dict[str, List[str]]] = {}
        for nt, prop_map in samples.items():
            final_samples[nt] = {
                prop_name: sorted(list(types_set))
                for prop_name, types_set in prop_map.items()
            }

        return (
            None,
            final_samples,
            dict(node_counts),
            {nt: dict(prop_map) for nt, prop_map in prop_counts.items()},
            {nt: dict(prop_map) for nt, prop_map in list_max.items()},
            {nt: dict(prop_map) for nt, prop_map in is_list.items()},
        )

    def generate_all(self) -> None:
        tasks: List[Tuple[str, str, str, str, List[str], bool, bool]] = []
        for root, _, files in os.walk(self.input_dir):
            for fname in files:
                if fname.endswith((".c", ".h")):
                    path = os.path.join(root, fname)
                    tasks.append(
                        (
                            path,
                            self.input_dir,
                            self.output_dir,
                            self.cpp_path,
                            self.cpp_args,
                            self.prune,
                            self.generate_receipt,
                        )
                    )

        # Combined accumulators across all files
        combined: Dict[str, Dict[str, set]] = defaultdict(_make_prop_set_dict)
        combined_node_counts: Dict[str, int] = _make_node_counts_dict()
        combined_prop_counts: Dict[str, Dict[str, int]] = _make_prop_counts_dict()
        combined_list_max: Dict[str, Dict[str, int]] = _make_list_max_dict()
        combined_is_list: Dict[str, Dict[str, bool]] = _make_is_list_dict()

        error_log = open(os.path.join(self.output_dir, "error.log"), "w+")
        with Pool(cpu_count()) as pool:
            for (
                err,
                sample,
                node_counts,
                prop_counts,
                list_max,
                is_list,
            ) in tqdm(
                pool.imap_unordered(ASTGenerator._process_file, tasks),
                total=len(tasks),
                desc="Processing files",
                unit="file",
            ):
                if err:
                    error_log.write(err + "\n")

                # ─── Merge sample types ────────────────────────────────────────
                for nt, prop_map in sample.items():
                    for prop_name, types_list in prop_map.items():
                        combined[nt][prop_name].update(types_list)

                # ─── Merge node_counts ────────────────────────────────────────
                for nt, count in node_counts.items():
                    combined_node_counts[nt] += count

                # ─── Merge prop_counts ────────────────────────────────────────
                for nt, prop_map in prop_counts.items():
                    for prop_name, count in prop_map.items():
                        combined_prop_counts[nt][prop_name] += count

                # ─── Merge list_max ───────────────────────────────────────────
                for nt, prop_map in list_max.items():
                    for prop_name, length in prop_map.items():
                        combined_list_max[nt][prop_name] = max(
                            combined_list_max[nt].get(prop_name, 0),
                            length,
                        )

                # ─── Merge is_list ────────────────────────────────────────────
                for nt, prop_map in is_list.items():
                    for prop_name, was_list in prop_map.items():
                        if was_list:
                            combined_is_list[nt][prop_name] = True

        if self.generate_receipt:
            # 1) Optional JSON output
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

            # 2) Generate TypeScript receipt with proper array vs. scalar logic
            ts_receipt_file = os.path.join(self.output_dir, "combined_receipt.ts")
            print("Writing TypeScript receipt to", ts_receipt_file)

            def python_to_ts(typename: str) -> str:
                mapping = {
                    "str": "string",
                    "int": "number",
                    "float": "number",
                    "bool": "boolean",
                    "NoneType": "null",
                    "list": "any[]",
                }
                return mapping.get(typename, typename)

            lines: List[str] = []
            lines.append("/* Auto-generated AST Receipt (TypeScript) */")
            lines.append("")
            lines.append("export interface ASTReceipt {")
            for nt, prop_map in combined.items():
                lines.append(f"  {nt}: {{")
                total_nodes = combined_node_counts.get(nt, 0)

                for prop_name, type_set in prop_map.items():
                    present_count = combined_prop_counts[nt].get(prop_name, 0)
                    optional_marker = "?" if present_count < total_nodes else ""

                    was_list = combined_is_list[nt].get(prop_name, False)
                    max_len = combined_list_max[nt].get(prop_name, 0)

                    # Translate Python‐type names → TS types or literals
                    ts_types = [python_to_ts(t) for t in sorted(type_set)]
                    ts_literals: List[str] = []
                    for t in ts_types:
                        if t in {"string", "number", "boolean", "null", "any[]"}:
                            ts_literals.append(t)
                        else:
                            ts_literals.append(f'"{t}"')
                    union_inner = " | ".join(ts_literals)

                    if was_list:
                        if max_len <= 1:
                            # List always ≤ 1 element → flatten to scalar union
                            ts_type_expr = union_inner
                        else:
                            # Sometimes > 1 → use Array<union>
                            ts_type_expr = f"Array<{union_inner}>"
                    else:
                        # Never a list → scalar union
                        ts_type_expr = union_inner

                    lines.append(f"    {prop_name}{optional_marker}: {ts_type_expr};")
                lines.append("  };")
            lines.append("}")
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
            m = re.match(r"^(.+)\[(\d+)\]$", child_name)
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
            m = re.match(r"^(.+)\[\d+\]$", child_name)
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
