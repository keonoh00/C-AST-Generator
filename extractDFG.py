from __future__ import annotations

import argparse
import os
from multiprocessing import Pool
from typing import Dict, List, Tuple

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
from src.dfg.extractor import DfgJsonBuilder, DfgOptions, Graph

console = Console()


def arg_parser():
    parser = argparse.ArgumentParser()
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


def _build_default_builder() -> DfgJsonBuilder:
    # Defaults:
    # - labels: {REACHING_DEF, DATA_FLOW, DDG_EDGE}
    # - intraprocedural_only: False
    # - include_isolated: False
    # - keep_fields: ("code", "line", "methodFullName")
    return DfgJsonBuilder(DfgOptions())


def _derive_out_path(cpg_path: str, save_root: str, base_root: str) -> str:
    if os.path.isdir(base_root):
        rel = os.path.relpath(cpg_path, base_root)
        rel_dir, base = os.path.split(rel)
        name, _ = os.path.splitext(base)
        return os.path.join(save_root, rel_dir, f"{name}.dfg.json")
    else:
        return save_root


def worker_job(args: Tuple[str, str, str]) -> Dict[str, object]:
    """
    Worker-safe function (no printing).
    Args:
      - cpg_path: path to GraphSON CPG
      - save_root: base output path (dir in batch, file in single)
      - base_root: `--cpg` root for batch or same file in single
    Returns a dict with keys:
      - cpg_path, out_path, ok (bool), issues (list[str])
    """
    cpg_path, save_root, base_root = args
    verifier = Verifier()
    typed, report = verifier.verify_and_type(cpg_path)

    out_path = _derive_out_path(cpg_path, save_root, base_root)

    if not report.ok:
        return {
            "cpg_path": cpg_path,
            "out_path": out_path,
            "ok": False,
            "issues": [f"{i.severity}: {i.message}" for i in report.issues],
        }

    builder = _build_default_builder()
    whole: Graph = builder.build_whole(typed)

    # Ensure parent dirs exist atomically here (works for both modes)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    builder.write_json(whole, out_path)

    return {
        "cpg_path": cpg_path,
        "out_path": out_path,
        "ok": True,
        "issues": [f"{i.severity}: {i.message}" for i in report.issues],
    }


def run_dir(cpg_dir: str, save_root: str) -> None:
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
        task = progress.add_task("extract", total=len(json_files))
        results: List[Dict[str, object]] = []

        # Use unordered to update the bar as soon as items finish
        with Pool(os.cpu_count() or 4) as p:
            for res in p.imap_unordered(
                worker_job, [(fp, save_root, cpg_dir) for fp in json_files]
            ):
                results.append(res)
                progress.advance(task)

    ok_count = sum(1 for r in results if r["ok"])
    fail_count = len(results) - ok_count
    console.log(f"[green]Completed[/] {ok_count}  [red]Failed[/] {fail_count}")

    # Print details for failures and any verification issues
    if fail_count:
        console.rule("[red]Failures")
        for r in results:
            if not r["ok"]:
                console.log(f"[red]FAILED[/] {r['cpg_path']}")
                for msg in r.get("issues", []):
                    console.log(f"  • {msg}")

    # Optionally show warnings/info from successful runs
    any_warns = False
    for r in results:
        if r["ok"]:
            issues: List[str] = r.get("issues", [])  # type: ignore[assignment]
            warn_msgs = [m for m in issues if m.startswith("WARN")]
            if warn_msgs:
                if not any_warns:
                    console.rule("[yellow]Warnings")
                    any_warns = True
                console.log(f"[yellow]{r['cpg_path']}[/]")
                for m in warn_msgs:
                    console.log(f"  • {m}")


def run_file(cpg_file: str, save_path: str) -> None:
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
        task = progress.add_task("extract", total=1)
        res = worker_job((cpg_file, save_path, cpg_file))
        progress.advance(task)

    if res["ok"]:
        console.log(f"[green]Saved[/] {res['out_path']}")
        # Show any warnings
        warn_msgs = [m for m in res.get("issues", []) if m.startswith("WARN")]  # type: ignore[arg-type]
        for m in warn_msgs:
            console.log(f"[yellow]• {m}[/]")
    else:
        console.log(f"[red]FAILED[/] {res['cpg_path']}")
        for m in res.get("issues", []):  # type: ignore[arg-type]
            console.log(f"  • {m}")


def main():
    args = arg_parser()
    cpg_path = args.cpg
    save_target = args.save

    if not os.path.exists(cpg_path):
        raise FileNotFoundError(f"Path {cpg_path} does not exist")

    if os.path.isdir(cpg_path):
        run_dir(cpg_path, save_target)
    else:
        # Ensure parent exists for single-file output
        parent = os.path.dirname(save_target)
        if parent:
            os.makedirs(parent, exist_ok=True)
        run_file(cpg_path, save_target)


if __name__ == "__main__":
    main()
