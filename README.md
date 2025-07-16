# C-AST-Generator

A tool to generate C Abstract Syntax Trees (ASTs) using Joern.
This tool extracts ASTs from C code, converts them to KAST format, and processes them for further analysis.

## Features

- Generates CPGs (Code Property Graphs) using Joern.
  - `joern-parse` and `joern-export` commands in parallel for efficient CPG generation.
  - Keeps the original data directory structure.
- Converts CPGs to KAST (KSIGN Abstract Syntax Tree) format.
  - Generates KAST templates from CPGs.
  - Outputs 4 different files
  - Includes a post-processing steps:
    - `addCodeProperties`: Adds code properties to the KAST nodes.
    - `isolateTranslationUnit`: Keep only the TranslationUnit node and its children from the AST.
    - `mergeArraySizeAllocation`: Merges array size allocation nodes with their parent nodes. (!!!!! Note: Not implemented yet !!!!!)
    - `removeInvalidNodes`: Removes nodes that are not valid in the context of KAST.
    - `updateMemberAccessTypeLength`: Updates the member access type length in the KAST nodes. (!!!!! Note: Not implemented yet !!!!!)

## Prerequisites

- Node.js (version 14 or higher)
- Joern 4.0.361 (installed and configured)
- Python 3.x (for concurrent processing CPG generation)

## Usage

### 1. Install dependencies

```bash
npm install && pip install -r script/requirements.txt
```

### 2. Run the tool

1. Full pipeline command (CPG + KAST generation):

   ```bash
    npm run generate:full --data="<input_directory>" --output="<output_directory (Optional default to tmp/YYYYMMDD-HHMMSS)>"
   ```

   Example:

   ```bash
    npm run generate:full --data="./C/testcases" --output="./result"
   ```

2. Step-by-step commands (Generating CPGs -> Generating KASTs):

   2-1. Generating Joern CPGs:

   ```bash
    # Generating CPGs using Joern
    # If the format of CPG is not compatible it will be errorred out
    # Has validation to ensure the CPG roots are valid
    npm run generate:cpg --data=<input_directory> --output=<output_directory (Optional: default to tmp/YYYYMMDD-HHMMSS)>
   ```

   Example:

   ```bash
    npm run generate:cpg --data="./C/testcases" --output="./cpgs"
   ```

   2-2. Generating KASTs from Joern CPGs:

   ```bash
    # Generating KASTs(Template) from Joern CPGs
    # The output will be in KAST format, which is compatible with KSIGN style ASTs
    # This requires the CPGs to be generated first in the previous step
    npm run generate:template --data=<input_directory> --output=<output_directory (Optional: default to tmp/YYYYMMDD-HHMMSS)>
   ```

   Example:

   ```bash
    npm run generate:template --data="./cpgs" --output="./kasts"
   ```

### 3. Output

- Final output will be in the specified output directory.
- Each source file will have 4 files:
  - `*_astTree.json`: The AST tree generated from the CPG, which contains the structure of the AST.
  - `*_templateTree.json`: The KAST tree generated from the CPG.
  - `*_flatten.json`: The flattened version of the KAST, node and edge separated with black list removed.
  - `*_text.txt`: The text representation of KAST, which is a human-readable format of the KAST.

### 4. Testing Open Source

1. Initialize git submodules:

   ```bash
   npm run submodule
   ```

2. Generating KAST on Mongoose:

   ```bash
   npm run mongoose
   ```

3. Generating KAST on Zephyr:

   ```bash
   npm run zephyr
   ```

## Development

- Use `npm run lint` to check code style.
- Use `npm run format` to format the code.
- Use `npm run test` to run tests.
