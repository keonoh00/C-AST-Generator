import json
import os
import re
import shutil
from multiprocessing import Pool, cpu_count
from typing import Any, List, Optional, Tuple

from pycparser import c_ast, c_parser, parse_file
from tqdm import tqdm


class ASTGenerator:
    def __init__(self, input_dir: str = "src", output_dir: str = "ast_output"):
        self.input_dir = input_dir
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        self.parser = c_parser.CParser()
        fake_libc = "/home/keonoh/C-AST-Generator/fake_libc_include"
        support_dir = "/home/keonoh/C-AST-Generator/data/C/testcasesupport"
        self.fake_paths = {fake_libc, support_dir}

        self.cpp_args: List[str] = [
            "-E",
            "-std=c99",
            "-nostdinc",  # ignore system include dirs
            f"-I{fake_libc}",
            f"-I{support_dir}",
        ]
        self.cpp_path = "gcc"

    def _parse_ast(self, path: str) -> c_ast.FileAST:
        return parse_file(
            filename=path,
            use_cpp=True,
            cpp_path=self.cpp_path,
            cpp_args=self.cpp_args,  # type: ignore
        )

    def _save_ast(self, ast: c_ast.FileAST, out_path: str) -> None:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w") as f:
            ast.show(buf=f)

    def _prune_ast_nodes(self, node: c_ast.Node) -> None:
        """
        Rebuild any list attributes by removing fake-include children,
        and set single-node attrs to None if they’re fake.
        """
        if not isinstance(node, c_ast.Node):
            return

        list_kept: dict[str, List[c_ast.Node]] = {}
        single_drop: set[str] = set()

        children = node.children() or []
        for child_name, child in children:
            m = re.match(r"^(.+)\[(\d+)\]$", child_name)
            coord = getattr(child, "coord", None)
            path = getattr(coord, "file", "") or ""
            if m:
                base = m.group(1)
                if base not in list_kept:
                    list_kept[base] = []
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

    @staticmethod
    def _process_file(args: Tuple[str, str, str, str, List[str]]) -> Optional[str]:
        in_path, input_dir, output_dir, cpp_path, cpp_args = args
        gen = ASTGenerator(input_dir=input_dir, output_dir=output_dir)
        gen.cpp_path = cpp_path
        gen.cpp_args = cpp_args

        rel_dir = gen._get_save_path(in_path)
        fname = os.path.basename(in_path)
        original = os.path.join(rel_dir, fname)
        ast_file = os.path.join(rel_dir, fname + ".ast")
        json_file = os.path.join(rel_dir, fname + ".json")

        shutil.copy2(in_path, original)
        try:
            ast = parse_file(
                in_path,
                use_cpp=True,
                cpp_path=gen.cpp_path,
                cpp_args=gen.cpp_args,  # type: ignore
            )
        except Exception as e:
            return f"{in_path}: {e}"

        gen._save_ast(ast, ast_file)
        gen.ast_to_json(ast, json_file)
        return None

    def generate_all(self) -> None:
        error_log = open(os.path.join(self.output_dir, "error.log"), "w+")
        tasks: List[Tuple[str, str, str, str, List[str]]] = []
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
                        )
                    )

        with Pool(cpu_count()) as pool:
            for err in tqdm(
                pool.imap_unordered(ASTGenerator._process_file, tasks),
                total=len(tasks),
                desc="Parsing ASTs",
                unit="file",
            ):
                if err:
                    error_log.write(err + "\n")

    def ast_to_json(self, ast: c_ast.FileAST, output_file: str) -> None:
        ast_dict = self._node_to_dict(ast)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(ast_dict, f, indent=2)

    def _node_to_dict(self, node: Any) -> Any:
        if not isinstance(node, c_ast.Node):
            return node
        result: dict[str, Any] = {"_nodetype": node.__class__.__name__}
        for attr in getattr(node, "attr_names", []) or []:
            result[attr] = getattr(node, attr)
        children_dict = {}
        for child_name, child in node.children() or []:
            children_dict.setdefault(child_name, []).append(self._node_to_dict(child))
        if children_dict:
            result["children"] = children_dict
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
    )
    gen.generate_all()
