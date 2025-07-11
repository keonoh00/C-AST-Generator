#!/usr/bin/env python2
# script/ghidra.py

"""
Jython postScript for Ghidra headless:
- Runs once per imported program (binary)
- Dumps C pseudocode of currentProgram to a designated output directory
"""

from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
import os

# Determine output directory (absolute path)
output_dir = "/home/keonoh/C-AST-Generator/data/decompiled"
# Create if missing
if not os.path.isdir(output_dir):
    os.makedirs(output_dir)

# Initialize decompiler for this program
decomp = DecompInterface()
decomp.openProgram(currentProgram)

# Prepare output file name based on binary name
program_name = currentProgram.getName()
safe_base = os.path.splitext(program_name)[0]
out_path = os.path.join(output_dir, safe_base + "_decompiled.c")

# Decompile all functions into one file
out_file = open(out_path, "w")
for func in currentProgram.getFunctionManager().getFunctions(True):
    out_file.write("// Function: %s\n" % func.getName())
    result = decomp.decompileFunction(func, 0, ConsoleTaskMonitor())
    out_file.write(result.getDecompiledFunction().getC())
    out_file.write("\n\n")
out_file.close()

# Log to console so headless log captures it
print("[GhidraScript] Decompiled %s to %s" % (program_name, out_path))