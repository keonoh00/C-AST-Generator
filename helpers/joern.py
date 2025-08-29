#!/usr/bin/env python3
import argparse
import json
import multiprocessing
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor, as_completed

from tqdm import tqdm  # Always require tqdm


def replace_macros(src_root, macro_exts):
    """
    Scan C code files for #define macros and replace occurrences with their definitions.
    Write results to new files with '_macro_replaced.c' suffix.
    """
    macros = {}
    define_lines = {}
    # First pass: collect macro definitions
    for root, dirs, files in os.walk(src_root):
        for fname in files:
            if any(fname.lower().endswith(ext) for ext in macro_exts):
                path = os.path.join(root, fname)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        define_lines[path] = []
                        for idx, line in enumerate(lines):
                            m = re.match(r"^\s*#define\s+(\w+)\s+(.+)", line)
                            if m:
                                name, val = m.groups()
                                macros[name] = val.strip()
                                define_lines[path].append(idx)
                except Exception:
                    continue
    if not macros:
        print("No macros found for replacement.", file=sys.stderr)
        return

    # Second pass: replace macros and write to _macro_replaced.c
    for root, dirs, files in os.walk(src_root):
        for fname in files:
            if any(fname.lower().endswith(ext) for ext in macro_exts):
                path = os.path.join(root, fname)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        lines = f.readlines()

                    updated_lines = []
                    for idx, line in enumerate(lines):
                        if idx in define_lines.get(path, []):
                            continue  # skip original #define lines
                        for name, val in macros.items():
                            pattern = r"\b" + re.escape(name) + r"\b"
                            line = re.sub(pattern, val, line)
                        updated_lines.append(line)

                    base, ext = os.path.splitext(fname)
                    new_fname = base + "_macro_replaced" + ext
                    new_path = os.path.join(root, new_fname)
                    with open(new_path, "w", encoding="utf-8") as f:
                        f.writelines(updated_lines)
                except Exception as e:
                    print(
                        f"[WARN] Failed to replace macros in {path}: {e}",
                        file=sys.stderr,
                    )


def process_file(task):
    src_file, src_root, out_root, joern_parse_cmd, joern_export_cmd = task
    rel_path = os.path.relpath(src_file, src_root)
    base, _ext = os.path.splitext(rel_path)
    out_rel_path = base + ".json"
    out_file = os.path.join(out_root, out_rel_path)
    try:
        os.makedirs(os.path.dirname(out_file), exist_ok=True)
    except Exception as e:
        return (src_file, False, f"Failed to create output dir: {e}")

    with tempfile.TemporaryDirectory() as tmpdir:
        parse_cmd = [joern_parse_cmd, src_file]
        proc_parse = subprocess.run(
            parse_cmd,
            cwd=tmpdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if proc_parse.returncode != 0:
            msg = proc_parse.stderr.strip() or "joern-parse returned non-zero exit"
            return (src_file, False, f"joern-parse failed: {msg}")

        cpg_path = os.path.join(tmpdir, "cpg.bin")
        if not os.path.isfile(cpg_path):
            return (src_file, False, "cpg.bin not found after joern-parse")

        export_cmd = [joern_export_cmd, "--repr=all", "--format=graphson"]
        proc_export = subprocess.run(
            export_cmd,
            cwd=tmpdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if proc_export.returncode != 0:
            msg = proc_export.stderr.strip() or "joern-export returned non-zero exit"
            return (src_file, False, f"joern-export failed: {msg}")

        out_dir = os.path.join(tmpdir, "out")
        if not os.path.isdir(out_dir):
            graphson_output = proc_export.stdout
            if graphson_output and graphson_output.strip().startswith("{"):
                try:
                    parsed = json.loads(graphson_output)
                    with open(out_file, "w", encoding="utf-8") as f:
                        json.dump(parsed, f)
                    return (src_file, True, "OK (stdout JSON)")
                except Exception as e:
                    return (src_file, False, f"Invalid JSON from stdout: {e}")
            return (
                src_file,
                False,
                "joern-export did not produce 'out' dir nor JSON on stdout",
            )

        merged = {}
        for entry in os.listdir(out_dir):
            path = os.path.join(out_dir, entry)
            if os.path.isfile(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception as e:
                    return (src_file, False, f"Failed to load JSON from {entry}: {e}")
                name, _ = os.path.splitext(entry)
                merged[name] = data

        if not merged:
            return (
                src_file,
                False,
                "No JSON files found in joern-export output directory",
            )

        try:
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(merged, f)
        except Exception as e:
            return (src_file, False, f"Failed writing merged JSON: {e}")

    return (src_file, True, "OK")


def gather_source_files(src_root, exts):
    src_files = []
    for root, dirs, files in os.walk(src_root):
        for fname in files:
            if exts:
                if any(fname.lower().endswith(ext.lower()) for ext in exts):
                    src_files.append(os.path.join(root, fname))
            else:
                src_files.append(os.path.join(root, fname))
    return src_files


def main():
    parser = argparse.ArgumentParser(
        description="Batch Joern parse+export per-file, preserving structure, merging 'out', with progress bar."
    )
    parser.add_argument(
        "--src-root",
        required=True,
        help="Root directory containing source files to parse",
    )
    parser.add_argument(
        "--out-root",
        required=True,
        help="Root directory where merged JSON outputs will be written",
    )
    parser.add_argument(
        "--ext",
        nargs="*",
        default=[".c", ".cpp", ".java", ".js", ".py"],
        help="File extensions to include. Use empty (no args) to include all files.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=(multiprocessing.cpu_count() or 1),
        help="Number of parallel workers. Defaults to CPU count.",
    )
    parser.add_argument(
        "--replace-macro",
        action="store_true",
        default=False,
        help="Scan and replace #define macros in C code before processing.",
    )
    parser.add_argument(
        "--joern-parse-cmd",
        default="joern-parse",
        help="Command or full path for joern-parse.",
    )
    parser.add_argument(
        "--joern-export-cmd",
        default="joern-export",
        help="Command or full path for joern-export.",
    )
    args = parser.parse_args()

    src_root = os.path.abspath(args.src_root)
    out_root = os.path.abspath(args.out_root)
    exts = args.ext
    workers = args.workers
    joern_parse_cmd = args.joern_parse_cmd
    joern_export_cmd = args.joern_export_cmd

    if args.replace_macro:
        replace_macros(src_root, [".c", ".h"])

    print(f"Scanning for source files under {src_root} ...", file=sys.stderr)
    src_files = gather_source_files(src_root, exts)
    total = len(src_files)
    print(f"Found {total} files to process.", file=sys.stderr)
    if total == 0:
        print("No files found. Exiting.", file=sys.stderr)
        return

    tasks = [
        (fpath, src_root, out_root, joern_parse_cmd, joern_export_cmd)
        for fpath in src_files
    ]

    successes = 0
    failures = []

    print(f"Processing {total} files with {workers} workers ...", file=sys.stderr)
    with ProcessPoolExecutor(max_workers=workers) as executor:
        future_to_file = {
            executor.submit(process_file, task): task[0] for task in tasks
        }
        pbar = tqdm(total=total, desc="Files processed", unit="file")
        for future in as_completed(future_to_file):
            src_file = future_to_file[future]
            try:
                file_path, ok, msg = future.result()
            except Exception as e:
                failures.append((src_file, f"Exception: {e}"))
                print(
                    f"[ERROR] Unexpected exception for {src_file}: {e}", file=sys.stderr
                )
            else:
                if ok:
                    successes += 1
                else:
                    failures.append((file_path, msg))
                    print(f"[FAIL] {file_path}: {msg}", file=sys.stderr)
            pbar.update(1)
        pbar.close()

    print(f"Done. Successes: {successes}, Failures: {len(failures)}", file=sys.stderr)
    if failures:
        print("Failures detailed below:", file=sys.stderr)
        for fpath, reason in failures:
            print(f"  {fpath}: {reason}", file=sys.stderr)
    else:
        print("All files processed successfully.", file=sys.stderr)


if __name__ == "__main__":
    main()
