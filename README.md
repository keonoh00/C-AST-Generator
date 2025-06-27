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

## Usage

1. Install dependencies:

```bash
npm install
```

2. Run the tool:

Full pipeline command:

```bash
npm run generate:full --data=<input_directory> --output=<output_directory (Optional)>
```

Generating CPG with Joern:

```bash
npm run generate:cpg --data=<input_directory> --output=<output_directory (Optional)>
```

Generating ASTs and converting to KAST(KSIGN Style AST):

```bash
npm run generate:template --data=<input_directory> --output=<output_directory (Optional)>
```

Replace `<input_directory>` with the directory containing C code and `<output_directory>` with the directory where you want to save the generated ASTs. 3. The tool will process the C code, extract ASTs, convert them to KAST format, and save the results in the specified output directory.

## Development

- Use `npm run lint` to check code style.
- Use `npm run format` to format the code.
- Use `npm run test` to run tests.
