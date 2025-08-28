from __future__ import annotations

import argparse
import os
from multiprocessing import Pool
from typing import Any, Dict, List, Tuple

from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)

from src.cpg.verification import Verifier
from src.dfg.extractor import DFGExtractor, DFGOptions, Graph

console = Console()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract DFGs from typed CPG GraphSON JSONs"
    )
    parser.add_argument(
        "--cpg",
        type=str,
        required=True,
        help="Path to a CPG JSON file or a directory of CPG JSONs",
    )
    parser.add_argument(
        "--save",
        type=str,
        required=True,
        help="Output file (for single) or directory (for batch)",
    )
    return parser.parse_args()


def _build_default_extractor() -> DFGExtractor:
    # Defaults:
    # - labels: {REACHING_DEF, DATA_FLOW, DDG_EDGE}
    # - intraprocedural_only: False
    # - include_isolated: False
    # - keep_fields: ("code", "line", "methodFullName")
    return DFGExtractor(DFGOptions())


def derive_output_path(cpg_path: str, save_root: str, base_root: str) -> str:
    if os.path.isdir(base_root):
        rel = os.path.relpath(cpg_path, base_root)
        rel_dir, base = os.path.split(rel)
        name, _ = os.path.splitext(base)
        return os.path.join(save_root, rel_dir, f"{name}.dfg.json")
    else:
        return save_root


def process_cpg_file(args: Tuple[str, str, str]) -> Dict[str, Any]:
    """
    Pure worker function to type-check a CPG and emit its DFG.
    Args:
      - cpg_path: path to GraphSON CPG
      - save_root: base output path (dir in batch, file in single)
      - base_root: `--cpg` root for batch or same file in single
    Returns a dict with keys: cpg_path, out_path, ok (bool), issues (list[str])
    """
    cpg_path, save_root, base_root = args
    verifier = Verifier()
    typed_cpg, verification = verifier.verify_and_type(cpg_path)

    out_path = derive_output_path(cpg_path, save_root, base_root)

    if not verification.ok:
        return {
            "cpg_path": cpg_path,
            "out_path": out_path,
            "ok": False,
            "issues": [f"{i.severity}: {i.message}" for i in verification.issues],
        }

    extractor = _build_default_extractor()
    whole_program_dfg: Graph = extractor.build_whole(typed_cpg)

    # Ensure parent dirs exist atomically here (works for both modes)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    extractor.write_json(whole_program_dfg, out_path)

    return {
        "cpg_path": cpg_path,
        "out_path": out_path,
        "ok": True,
        "issues": [f"{i.severity}: {i.message}" for i in verification.issues],
    }


def process_directory(cpg_dir: str, save_root: str) -> None:
    json_files: List[str] = []
    for root, _dirs, files in os.walk(cpg_dir):
        for file in files:
            if file.endswith(".json"):
                json_files.append(os.path.join(root, file))

    if not json_files:
        console.log(f"[yellow]No .json files under[/] {cpg_dir}")
        return

    console.log(f"[bold]Scanning[/] {cpg_dir} → {len(json_files)} file(s)")
    os.makedirs(save_root, exist_ok=True)

    progress = Progress(
        TextColumn("[bold blue]DFG[/]"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
        SpinnerColumn("dots"),
        TextColumn("{task.description}"),
        console=console,
        transient=False,
    )
    with progress:
        progress_task = progress.add_task("extract", total=len(json_files))
        results: List[Dict[str, Any]] = []

        # Use unordered to update the bar as soon as items finish
        with Pool(os.cpu_count() or 4) as pool:
            for result in pool.imap_unordered(
                process_cpg_file, [(fp, save_root, cpg_dir) for fp in json_files]
            ):
                results.append(result)
                progress.advance(progress_task)

    success_count = sum(1 for item in results if item["ok"])  # type: ignore[index]
    fail_count = len(results) - success_count
    console.log(f"[green]Completed[/] {success_count}  [red]Failed[/] {fail_count}")

    # Print details for failures and any verification issues
    if fail_count:
        console.rule("[red]Failures")
        for item in results:
            if not item["ok"]:  # type: ignore[index]
                console.log(f"[red]FAILED[/] {item['cpg_path']}")
                issues_list: List[str] = item.get("issues", [])
                for message in issues_list:
                    console.log(f"  • {message}")

    # Optionally show warnings/info from successful runs
    any_warnings = False
    for item in results:
        if item["ok"]:  # type: ignore[index]
            issues_any: Any = item.get("issues", [])
            issues: List[str] = issues_any if isinstance(issues_any, list) else []
            warning_messages = [
                msg for msg in issues if isinstance(msg, str) and msg.startswith("WARN")
            ]
            if warning_messages:
                if not any_warnings:
                    console.rule("[yellow]Warnings")
                    any_warnings = True
                console.log(f"[yellow]{item['cpg_path']}[/]")
                for message in warning_messages:
                    console.log(f"  • {message}")


def process_single_file(cpg_file: str, save_path: str) -> None:
    console.log(f"[bold]Processing[/] {cpg_file}")
    progress = Progress(
        TextColumn("[bold blue]DFG[/]"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        SpinnerColumn("dots"),
        TextColumn("{task.description}"),
        console=console,
        transient=True,
    )
    with progress:
        progress_task = progress.add_task("extract", total=1)
        result = process_cpg_file((cpg_file, save_path, cpg_file))
        progress.advance(progress_task)

    if result["ok"]:  # type: ignore[index]
        console.log(f"[green]Saved[/] {result['out_path']}")

        issues_list_any: List[Any] = result.get("issues", [])
        warning_messages = [
            msg
            for msg in issues_list_any
            if isinstance(msg, str) and msg.startswith("WARN")
        ]
        for message in warning_messages:
            console.log(f"[yellow]• {message}[/]")
    else:
        console.log(f"[red]FAILED[/] {result['cpg_path']}")
        issues_any: Any = result.get("issues", [])
        issues_list_str: List[str] = issues_any if isinstance(issues_any, list) else []
        for message in issues_list_str:
            console.log(f"  • {message}")


def main():
    args = parse_args()
    cpg_path = args.cpg
    save_target = args.save

    if not os.path.exists(cpg_path):
        raise FileNotFoundError(f"Path {cpg_path} does not exist")

    if os.path.isdir(cpg_path):
        process_directory(cpg_path, save_target)
    else:
        # Ensure parent exists for single-file output
        parent = os.path.dirname(save_target)
        if parent:
            os.makedirs(parent, exist_ok=True)
        process_single_file(cpg_path, save_target)


if __name__ == "__main__":
    main()
