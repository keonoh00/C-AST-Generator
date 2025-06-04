import { readJsonFiles } from "@/nodeFactory/utils/readJson";
import { ASTValidator } from "@/nodeFactory/utils/validator";

const target = "./ast_output";

const results: unknown[] = [];

readJsonFiles(target)
  .then((val: unknown[]) => {
    const validator = new ASTValidator();
    for (const obj of val) {
      try {
        validator.validate(obj);
        results.push(obj);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[validation-failed]", msg);
      }
    }

    console.log(`Validated AST nodes (${String(results.length)}):`, results);
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Failed to read JSON files:", msg);
    process.exit(1);
  });

// const convertedNodes = convertRawNodes(results);
