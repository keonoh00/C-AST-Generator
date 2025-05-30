import json
import os
import re
import shutil
from collections import defaultdict
from multiprocessing import Pool, cpu_count
from typing import Any, Dict, List, Optional, Tuple

from pycparser import c_ast, c_parser, parse_file
from tqdm import tqdm


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
    ) -> Tuple[Optional[str], Dict[str, List[Tuple[str, ...]]]]:
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
            return f"{infile}: {e}", {}

        gen._save_ast(ast, ast_file)
        gen.ast_to_json(ast, json_file)

        samples: Dict[str, set] = defaultdict(set)
        if gen.generate_receipt:

            def _traverse(node: Any) -> None:
                if not isinstance(node, c_ast.Node):
                    return
                nt = node.__class__.__name__
                attrs = set(getattr(node, "attr_names", []) or [])
                children = [name for name, _ in node.children() or []]
                props = tuple(sorted(attrs.union(children)))
                samples[nt].add(props)
                for _, child in node.children() or []:
                    _traverse(child)

            _traverse(ast)

        return None, {nt: list(props_set) for nt, props_set in samples.items()}

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

        combined: Dict[str, set] = defaultdict(set)
        error_log = open(os.path.join(self.output_dir, "error.log"), "w+")
        with Pool(cpu_count()) as pool:
            for err, sample in tqdm(
                pool.imap_unordered(ASTGenerator._process_file, tasks),
                total=len(tasks),
                desc="Processing files",
                unit="file",
            ):
                if err:
                    error_log.write(err + "\n")
                for nt, props_list in sample.items():
                    for props in props_list:
                        combined[nt].add(props)

        if self.generate_receipt:
            receipt_file = os.path.join(self.output_dir, "combined_receipt.json")
            print("Writing combined receipt...")
            receipt = {
                nt: [list(props) for props in prop_sets]
                for nt, prop_sets in combined.items()
            }
            with open(receipt_file, "w") as f:
                json.dump(receipt, f, indent=2)
            print("Combined receipt written to", receipt_file)

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
        # Base of the JSON node
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
