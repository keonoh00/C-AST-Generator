#!/usr/bin/env bash
set -euo pipefail

# decompile.sh - automate Ghidra headless decompilation
# Usage: sudo decompile.sh <project-root> <binary-directory> [<output-dir>]
# Example:
#   sudo decompile.sh ./ghidra/data/compiled/SARD_Juliet ./ghidra/data/compiled/SARD_Juliet /home/keonoh/C-AST-Generator/data/decompiled/SARD_Juliet

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <project-root> <binary-dir> [<output-dir>]" >&2
  exit 1
fi

PROJECT_ROOT="$1"
BINARY_DIR="$2"
OUTPUT_DIR="${3:-$PROJECT_ROOT/decompiled}"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo "→ Decompiling binaries from '$BINARY_DIR' into '$OUTPUT_DIR'"

# Run Ghidra headless
ghidraHeadless "$PROJECT_ROOT" "MyProject" \
  -import "$BINARY_DIR" \
  -recursive \
  -overwrite \
  -log "$PROJECT_ROOT/ghidra_headless.log" \
  -scriptPath script \
  -postScript ghidra.py

# Move or copy decompiled files if script writes elsewhere
if [[ -d "$PROJECT_ROOT/decompiled" ]]; then
  mv "$PROJECT_ROOT/decompiled"/* "$OUTPUT_DIR" || true
fi

echo "✔ Decompilation complete. Files are in '$OUTPUT_DIR'"
