# Static Software Analysis Tool (SSAT)

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

### Directory Structure Overview

```bash
   .
   ├── README.md
   ├── script
   │   ├── joern.py
   │   └── requirements.txt
   ├── src
   │   ├── joern
   │   │   ├── generateAST.tsdd
   │   │   ├── ast
   │   │   │   └── ASTExtractor.ts
   │   │   ├── kast
   │   │   │   ├── BinaryExpression.ts
   │   │   │   ├── BinaryUnaryTypeWrapper.ts
   │   │   │   ├── KASTConverter.ts
   │   │   │   ├── PostProcessor.ts
   │   │   │   ├── Predefined.ts
   │   │   │   ├── StandardLibCall.ts
   │   │   │   └── UnaryExpression.ts
   │   │   ├── planation
   │   │   │   └── PlanationTool.ts
   │   │   ├── utils
   │   │   │   └── TreeToText.ts
   │   │   └── validate
   │   │       └── zod.ts
   │   ├── types
   │   └── utils
   │       ├── listJson.ts
   │       ├── readJson.ts
   │       └── writeJson.ts
   ├── test.c
   └── tsconfig.json
```

- `README.md`: 이 문서 파일로, 프로젝트에 대한 설명과 사용법을 포함합니다.
- `script`: Joern CPG 생성 위한 스크립트 디렉토리.
  - `joern.py`: Joern CPG 생성을 위한 Python 스크립트 - 병렬처리 및 오리지널 디렉토리 유지.
  - `requirements.txt`: Python 의존성 패키지 목록.
- `src`: TypeScript 소스 코드 디렉토리.
  - `src/joern/generateAST.ts`: Joern CPG에서 ASTKAST를 생성하는 메인 파일.
  - `src/joern`: Joern CPG 기반의 다양한 코드 디렉토리.
  - `src/joern/ast`: Joern CPG에서 AST를 추출하는 모듈 디렉토리.
    - `ASTExtractor.ts`: Joern CPG에서 AST를 추출하는 모듈.
  - `src/joern/kast`: KAST 변환 관련 코드 디렉토리.
    - `BinaryExpression.ts`: KAST에서 이진 표현식 노드로 변환될 CPG 노드 정의.
    - `BinaryUnaryTypeWrapper.ts`: 이진 및 단항 표현식 타입 래퍼. BinaryExpression과 UnaryExpression의 타입을 추출하는 코드.
    - `KASTConverter.ts`: Joern CPG를 KAST로 변환하는 모듈.
    - `PostProcessor.ts`: KAST 후처리 코드 - 변환 안된 노드 삭제(건너뛴 노드) 등등.
    - `Predefined.ts`: KAST의 사전 정의된 Identifier 노드들 특정 Identifier의 타입과 Identifier -> Literal로 변환할 노드.
    - `StandardLibCall.ts`: 표준 라이브러리 호출 노드 사전 정의.
    - `UnaryExpression.ts`: KAST의 단항 표현식 노드 사전 정의.
  - `src/joern/planation`: KAST 평탄화 관련 코드 디렉토리 (현재는 노드 삭제 및 node & edge 구조 변환 수준).
    - `PlanationTool.ts`: KAST 평탄화 도구 모듈.
  - `src/joern/utils`: Joern 관련 유틸리티 코드 디렉토리.
    - `TreeToText.ts`: 트리를 텍스트로 변환하는 유틸리티 코드.
  - `src/joern/validate`: Joern CPG 유효성 검사 관련 코드 디렉토리.
    - `zod.ts`: Joern CPG 유효성 검사 코드.
- `src/types`: Joern CPG 및 KAST 변환 이후 타입 정의 디렉토리.\
   **각 노드 별로 어떤 속성들이 있는지 보고싶으면 여기서 보면 됩니다**
- `src/utils`: JSON 파일 목록을 리스트로 반환하고 읽고 쓰는 유틸리티 함수 디렉토리.
  - `listJson.ts`: JSON 파일 목록을 리스트로 반환하는 유틸리티 함수.
  - `readJson.ts`: JSON 파일을 읽어오는 유틸리티 함수.
  - `writeJson.ts`: JSON 파일을 쓰는 유틸리티 함수.
