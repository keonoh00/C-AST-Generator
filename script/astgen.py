#!/usr/bin/env python3
import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from multiprocessing import Pool, cpu_count
from typing import Optional

from pycparser import c_ast, parse_file
from tqdm import tqdm

# ─── Increase recursion limit to avoid deep AST RecursionError ─────────────
sys.setrecursionlimit(10_000)

# ─── Precompiled regex for splitting child names like "decl[0]" → "decl" ───
_CHILD_LIST_REGEX = re.compile(r"^(.+)\[\d+\]$")

# ─── Module‐level cache for one ASTGenerator per worker ────────────────────
_cached_gen: Optional["ASTGenerator"] = None


@dataclass(frozen=True)
class WorkerConfig:
    input_dir: str
    output_dir: str
    support_dir: str
    prune: bool


class ASTGenerator:
    def __init__(
        self,
        input_dir: str,
        output_dir: str,
        support_dir: str,
        prune: bool = True,
    ):
        """
        - input_dir: directory to scan for .c/.h files
        - output_dir: where .ast and .json files go
        - support_dir: path to the testcasesupport directory
        - prune: whether to prune fake-libc nodes out of the AST
        """
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.support_dir = support_dir
        self.prune = prune

        os.makedirs(self.output_dir, exist_ok=True)

        # fake_libc is fixed relative to this script's location
        fake_libc = os.path.join(os.path.dirname(__file__), "fake_libc_include")
        self.fake_paths = {fake_libc, support_dir}

        self.cpp_args = [
            "-E",
            "-std=c99",
            "-nostdinc",
            f"-I{fake_libc}",
            f"-I{support_dir}",
        ]
        self.cpp_path = "gcc"

    def _get_save_dir(self, path: str) -> str:
        rel = os.path.relpath(path, self.input_dir)
        rel_dir = os.path.dirname(rel)
        out_dir = os.path.join(self.output_dir, rel_dir)
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
        list_kept: dict[str, list[c_ast.Node]] = {}
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

    def _node_to_dict(self, node: object) -> object:
        if isinstance(node, list):
            return [self._node_to_dict(child) for child in node]

        if not isinstance(node, c_ast.Node):
            return node

        result: dict[str, object] = {"kind": type(node).__name__}

        coord = getattr(node, "coord", None)
        if coord:
            result["coord"] = str(coord)

        for attr in getattr(node, "attr_names", []) or []:
            result[attr] = getattr(node, attr)  # type: ignore

        raw_children: dict[str, list[object]] = {}
        for child_name, child in node.children() or []:
            m = _CHILD_LIST_REGEX.match(child_name)
            key = m.group(1) if m else child_name
            child_dict = self._node_to_dict(child)
            raw_children.setdefault(key, []).append(child_dict)

        if raw_children:
            flattened: dict[str, object] = {}
            for key, lst in raw_children.items():
                if len(lst) == 1:
                    flattened[key] = lst[0]
                else:
                    flattened[key] = lst
            result["children"] = flattened  # type: ignore

        return result

    @staticmethod
    def _process_file(args: tuple[str, WorkerConfig]) -> Optional[str]:
        infile, cfg = args
        global _cached_gen

        if _cached_gen is None:
            _cached_gen = ASTGenerator(
                input_dir=cfg.input_dir,
                output_dir=cfg.output_dir,
                support_dir=cfg.support_dir,
                prune=cfg.prune,
            )

        gen = _cached_gen
        out_dir = gen._get_save_dir(infile)
        fname = os.path.basename(infile)

        dst_source = os.path.join(out_dir, fname)
        os.makedirs(os.path.dirname(dst_source), exist_ok=True)
        shutil.copy2(infile, dst_source)

        try:
            ast = gen._parse_ast(infile)
        except Exception as e:
            return f"{infile}: {e}"

        ast_file = os.path.join(out_dir, fname + ".ast")
        gen._save_ast(ast, ast_file)

        json_file = os.path.join(out_dir, fname + ".json")
        gen.ast_to_json(ast, json_file)

        return None

    def generate_all(self) -> None:
        tasks: list[tuple[str, WorkerConfig]] = []
        for root, _, files in os.walk(self.input_dir):
            for fname in files:
                if not fname.endswith((".c", ".h")):
                    continue
                path = os.path.join(root, fname)
                tasks.append(
                    (
                        path,
                        WorkerConfig(
                            input_dir=self.input_dir,
                            output_dir=self.output_dir,
                            support_dir=self.support_dir,
                            prune=self.prune,
                        ),
                    )
                )

        total_tasks = len(tasks)
        if total_tasks == 0:
            print("No .c or .h files found in input directory.", file=sys.stderr)
            return

        error_log_path = os.path.join(self.output_dir, "error.log")
        with open(error_log_path, "w") as error_log:
            with Pool(cpu_count()) as pool:
                with tqdm(
                    total=total_tasks, desc="Processing files", unit="file"
                ) as pbar:
                    for result in pool.imap_unordered(
                        ASTGenerator._process_file, tasks
                    ):
                        if result is not None:
                            error_log.write(result + "\n")
                        pbar.update(1)


if __name__ == "__main__":
    gen = ASTGenerator(
        input_dir="/home/keonoh/C-AST-Generator/data/C/testcases",
        output_dir="ast_output",
        prune=True,
        support_dir="/home/keonoh/C-AST-Generator/data/C/testcasesupport",
    )
    gen.generate_all()
