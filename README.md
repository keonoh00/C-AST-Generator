# C-AST-Generator

A tool to generate C Abstract Syntax Trees (ASTs) using Joern.
This tool extracts ASTs from C code, converts them to KAST format, and processes them for further analysis.

## Features

- Extracts ASTs from C code using Joern
- Converts ASTs to KAST format
- Processes KASTs for analysis
- Supports planation of KASTs
- Validates CPG roots
- Provides utilities for listing and writing JSON files

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

## Development

- Use `npm run lint` to check code style.
- Use `npm run format` to format the code.
- Use `npm run test` to run tests.
