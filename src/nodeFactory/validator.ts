/**
 * Each AST node must include a `_nodetype` literal and may optionally
 * have `children`. Primitive properties (e.g., `name`, `op`, or arrays
 * of strings) are typed accordingly.
 */

export interface ArrayDeclNode {
  /** Discriminator */
  _nodetype: "ArrayDecl";

  /**
   * Child‐nodes under this ArrayDecl:
   *  - `type` is always present, pointing to either a pointer or a type declaration.
   *  - `dim` is optional; when present, it may be a BinaryOp, Constant, or ID node.
   */
  children?: {
    dim?: BinaryOpNode | ConstantNode | IDNode;
    type: PtrDeclNode | TypeDeclNode;
  };

  /**
   * Qualifiers on the array dimension (e.g. `const`, `volatile`).
   * Always emitted as a string array (even if empty).
   */
  dim_quals: string[];
}

export interface ArrayRefNode {
  _nodetype: "ArrayRef";

  /**
   * Child‐nodes under this ArrayRef:
   *  - `name` is the base expression (ID or StructRef).
   *  - `subscript` is the index expression (BinaryOp, Constant, or ID).
   */
  children?: {
    name: IDNode | StructRefNode;
    subscript: BinaryOpNode | ConstantNode | IDNode;
  };
}

export interface AssignmentNode {
  _nodetype: "Assignment";

  /**
   * Child‐nodes under this Assignment:
   *  - `lvalue` is the location being assigned (ArrayRef, ID, StructRef, or UnaryOp).
   *  - `rvalue` is the expression being assigned (ArrayRef, Cast, Constant, FuncCall, ID, or UnaryOp).
   */
  children?: {
    lvalue: ArrayRefNode | IDNode | StructRefNode | UnaryOpNode;
    rvalue: ArrayRefNode | CastNode | ConstantNode | FuncCallNode | IDNode | UnaryOpNode;
  };

  /** The assignment operator (e.g. "=", "+=", etc.). */
  op: string;
}

/**
 * The union of all valid AST node interfaces.
 * Each variant’s `_nodetype` literal must match one of these names.
 */
export type ASTNodeJSON =
  | ArrayDeclNode
  | ArrayRefNode
  | AssignmentNode
  | BinaryOpNode
  | BreakNode
  | CaseNode
  | CastNode
  | CompoundNode
  | ConstantNode
  | DeclNode
  | DefaultNode
  | DoWhileNode
  | ExprListNode
  | FileASTNode
  | ForNode
  | FuncCallNode
  | FuncDeclNode
  | FuncDefNode
  | GotoNode
  | IdentifierTypeNode
  | IDNode
  | IfNode
  | InitListNode
  | LabelNode
  | ParamListNode
  | PtrDeclNode
  | ReturnNode
  | StructNode
  | StructRefNode
  | SwitchNode
  | TernaryOpNode
  | TypeDeclNode
  | TypedefNode
  | TypenameNode
  | UnaryOpNode
  | UnionNode
  | WhileNode;

/**
 * A binary operation (e.g. "a + b" or "x - y").
 */
export interface BinaryOpNode {
  _nodetype: "BinaryOp";

  /**
   * Child‐nodes under this BinaryOp:
   *  - `left`: the left operand (may be another BinaryOp, Cast, Constant, FuncCall, ID, or UnaryOp).
   *  - `right`: the right operand (may be BinaryOp, Constant, FuncCall, ID, or UnaryOp).
   */
  children?: {
    left: BinaryOpNode | CastNode | ConstantNode | FuncCallNode | IDNode | UnaryOpNode;
    right: BinaryOpNode | ConstantNode | FuncCallNode | IDNode | UnaryOpNode;
  };

  /** The operator symbol (e.g. "+", "-", "*", "/"). */
  op: string;
}

/** A bare `break;` statement. */
export interface BreakNode {
  _nodetype: "Break";
}

/**
 * A `case X:` label inside a `switch`.
 * - `expr` is the constant to match.
 * - `stmts` is the list of statements under that case.
 */
export interface CaseNode {
  _nodetype: "Case";

  children?: {
    expr: ConstantNode;

    /** Zero or more statements; typical statements include Assignment, Break, Compound, FuncCall, If, etc. */
    stmts: (
      | AssignmentNode
      | BreakNode
      | CompoundNode
      | ConstantNode
      | ForNode
      | FuncCallNode
      | IfNode
      | LabelNode
      | ReturnNode
      | SwitchNode
      | UnaryOpNode
      | WhileNode
    )[];
  };
}

/**
 * A C‐style cast, e.g. `(type) expr`.
 * - `to_type` is a TypenameNode describing the target type.
 * - `expr` is the expression being cast.
 */
export interface CastNode {
  _nodetype: "Cast";

  children?: {
    expr: BinaryOpNode | CastNode | ConstantNode | FuncCallNode | IDNode | StructRefNode | TernaryOpNode | UnaryOpNode;

    to_type: TypenameNode;
  };
}

/**
 * A compound statement (block), e.g. `{ stmt1; stmt2; }`.
 * The `block_items` array may contain declarations, expressions, control flow, etc.
 */
export interface CompoundNode {
  _nodetype: "Compound";

  children?: {
    block_items: (
      | AssignmentNode
      | BreakNode
      | CaseNode
      | CastNode
      | CompoundNode
      | DeclNode
      | DefaultNode
      | DoWhileNode
      | ForNode
      | FuncCallNode
      | GotoNode
      | IfNode
      | LabelNode
      | ReturnNode
      | SwitchNode
      | UnaryOpNode
      | WhileNode
    )[];
  };
}

/**
 * A constant literal, e.g. `42`, `"hello"`, or `0xFF`.
 * - `type` is the literal’s type (e.g. `"int"` or `"string"`).
 * - `value` is the literal’s textual value.
 */
export interface ConstantNode {
  _nodetype: "Constant";
  type: string;
  value: string;
}

/**
 * A declaration, e.g. `int x = 5;`.
 * - `name` is the identifier.
 * - `quals` and `storage` are string‐array qualifiers (e.g. `["const"]`).
 * - `funcspec` holds function‐specifier keywords (e.g. `["inline"]`).
 * - `align` is any alignment qualifiers (empty array if none).
 * - `children.type` is the type expression (ArrayDecl, FuncDecl, PtrDecl, or TypeDecl).
 * - `children.init` is optional: the initializer expression (ArrayRef, Cast, Constant, FuncCall, ID, InitList, StructRef, or UnaryOp).
 */
export interface DeclNode {
  _nodetype: "Decl";

  /** Alignment qualifiers (always a string array, even if empty). */
  align: string[];

  children?: {
    init?: ArrayRefNode | CastNode | ConstantNode | FuncCallNode | IDNode | InitListNode | StructRefNode | UnaryOpNode;
    type: ArrayDeclNode | FuncDeclNode | PtrDeclNode | TypeDeclNode;
  };

  /** Function specifiers like `inline`, `static`, etc. (always string[]). */
  funcspec: string[];

  /** The declared identifier name. */
  name: string;

  /** Type qualifiers like `const`, `volatile`, etc. (always string[]). */
  quals: string[];

  /** Storage class specifiers like `typedef`, `static`, etc. (always string[]). */
  storage: string[];
}

/**
 * A `default:` label inside a `switch`.
 * `stmts` is the list of statements under that default label.
 */
export interface DefaultNode {
  _nodetype: "Default";

  children?: {
    stmts: (AssignmentNode | BreakNode | CompoundNode | FuncCallNode)[];
  };
}

/**
 * A `do { ... } while (cond);` loop.
 * - `cond` must be a Constant or BinaryOp.
 * - `stmt` is the compound body.
 */
export interface DoWhileNode {
  _nodetype: "DoWhile";

  children?: {
    cond: BinaryOpNode | ConstantNode;
    stmt: CompoundNode;
  };
}

/**
 * A comma‐separated list of expressions, e.g. in function arguments.
 * `exprs` is an array of valid expression nodes.
 */
export interface ExprListNode {
  _nodetype: "ExprList";

  children?: {
    exprs: (ArrayRefNode | BinaryOpNode | CastNode | ConstantNode | FuncCallNode | IDNode | StructRefNode | UnaryOpNode)[];
  };
}

/**
 * The root of every parsed file’s AST.
 * `children.ext` is an array of top‐level external declarations:
 *  - DeclNode for variable/typedef/struct/union declarations
 *  - FuncDefNode for function definitions
 *  - TypedefNode for standalone typedefs
 */
export interface FileASTNode {
  _nodetype: "FileAST";

  children?: {
    ext: (DeclNode | FuncDefNode | TypedefNode)[];
  };
}

/**
 * A `for (init; cond; next) stmt` loop.
 * - `init` is an Assignment.
 * - `cond` is a BinaryOp.
 * - `next` is a UnaryOp (e.g. `i++`).
 * - `stmt` is the loop body (Compound).
 */
export interface ForNode {
  _nodetype: "For";

  children?: {
    cond: BinaryOpNode;
    init: AssignmentNode;
    next: UnaryOpNode;
    stmt: CompoundNode;
  };
}

/**
 * A function call, e.g. `printf("hello");`.
 * - `name` is an IDNode for the function’s name.
 * - `args` is optional: if present, it’s an ExprListNode of argument expressions.
 */
export interface FuncCallNode {
  _nodetype: "FuncCall";

  children?: {
    args?: ExprListNode;
    name: IDNode;
  };
}

/**
 * A function declaration (no body), e.g. `int foo(int, char);`.
 * - `type` is either a PtrDeclNode or TypeDeclNode.
 * - `args` is optional: a ParamListNode describing the parameter list.
 */
export interface FuncDeclNode {
  _nodetype: "FuncDecl";

  children?: {
    args?: ParamListNode;
    type: PtrDeclNode | TypeDeclNode;
  };
}

/**
 * A function definition, e.g. `int main() { ... }`.
 * - `decl` is the DeclNode for the function’s signature.
 * - `body` is the CompoundNode for the function’s body.
 */
export interface FuncDefNode {
  _nodetype: "FuncDef";

  children?: {
    body: CompoundNode;
    decl: DeclNode;
  };
}

/** A `goto label;` statement. */
export interface GotoNode {
  _nodetype: "Goto";
  name: string;
}

/**
 * A list of raw type names, e.g. `{"names":["int","unsigned"]}`.
 * Always a string array.
 */
export interface IdentifierTypeNode {
  _nodetype: "IdentifierType";
  names: string[];
}

/** A simple identifier reference, e.g. `x` or `y`. */
export interface IDNode {
  _nodetype: "ID";
  name: string;
}

/**
 * An `if` statement.
 * - `cond` is the condition (BinaryOp, Constant, FuncCall, or ID).
 * - `iftrue` is the “then” branch (Compound or FuncCall).
 * - `iffalse` is optional: the “else” branch (Compound).
 */
export interface IfNode {
  _nodetype: "If";

  children?: {
    cond: BinaryOpNode | ConstantNode | FuncCallNode | IDNode;
    iffalse?: CompoundNode;
    iftrue: CompoundNode | FuncCallNode;
  };
}

/**
 * An initializer list, e.g. `{1, 2, 3}`.
 * `exprs` is an array of ConstantNode, IDNode, or UnaryOpNode.
 */
export interface InitListNode {
  _nodetype: "InitList";

  children?: {
    exprs: (ConstantNode | IDNode | UnaryOpNode)[];
  };
}

/**
 * A `label:` in front of a statement.
 * - `stmt` may be an Assignment, Compound, or FuncCall.
 */
export interface LabelNode {
  _nodetype: "Label";

  children?: {
    stmt: AssignmentNode | CompoundNode | FuncCallNode;
  };

  name: string;
}

/**
 * A parameter list inside a function prototype, e.g. `(int a, char b)`.
 * `params` is an array of DeclNode or TypenameNode.
 */
export interface ParamListNode {
  _nodetype: "ParamList";

  children?: {
    params: (DeclNode | TypenameNode)[];
  };
}

/**
 * A pointer declarator, e.g. `int *p;`.
 * - `quals` is a string array of pointer qualifiers (e.g. `["const"]`).
 * - `type` is the next level of declaration (another PtrDecl or a TypeDecl).
 */
export interface PtrDeclNode {
  _nodetype: "PtrDecl";

  children?: {
    type: FuncDeclNode | PtrDeclNode | TypeDeclNode;
  };

  quals: string[];
}

/**
 * A `return expr;` statement.
 * `expr` is optional (e.g. `return;` vs. `return x;`).
 */
export interface ReturnNode {
  _nodetype: "Return";

  children?: {
    expr?: ConstantNode | IDNode;
  };
}

/**
 * A `struct Foo { ... };` declaration.
 * - `name` is the struct’s tag (or null if anonymous).
 * - `decls` is the array of member declarations (DeclNodes).
 */
export interface StructNode {
  _nodetype: "Struct";

  children?: {
    decls?: DeclNode[];
  };

  name: null | string;
}

/**
 * A reference to a field inside a struct/unions, e.g. `x.field` or `ptr->field`.
 * - `name` is the base expression (ArrayRef, ID, or nested StructRef).
 * - `field` is the field’s IDNode.
 * - `type` is the operator (`.` or `->`).
 */
export interface StructRefNode {
  _nodetype: "StructRef";

  children?: {
    field: IDNode;
    name: ArrayRefNode | IDNode | StructRefNode;
  };

  type: string;
}

/**
 * A `switch(expr) { ... }` statement.
 * - `cond` is typically a Constant or ID.
 * - `stmt` is the CompoundNode for the switch’s body.
 */
export interface SwitchNode {
  _nodetype: "Switch";

  children?: {
    cond: ConstantNode | IDNode;
    stmt: CompoundNode;
  };
}

/**
 * A ternary operation, e.g. `cond ? iftrue : iffalse`.
 * Each branch must be a BinaryOp.
 */
export interface TernaryOpNode {
  _nodetype: "TernaryOp";

  children?: {
    cond: BinaryOpNode;
    iffalse: BinaryOpNode;
    iftrue: BinaryOpNode;
  };
}

/**
 * A type declaration, e.g. `typedef struct X X;` or the type part of a variable
 * declaration.
 * - `declname` is the declared identifier (or null if anonymous).
 * - `quals` is a string array of type qualifiers.
 * - `align` is always null for TypeDecl.
 * - `children.type` is either an IdentifierType, Struct, or Union node.
 */
export interface TypeDeclNode {
  _nodetype: "TypeDecl";

  align: null;

  children?: {
    type: IdentifierTypeNode | StructNode | UnionNode;
  };

  declname: null | string;
  quals: string[];
}

/**
 * A `typedef <type> name;` declaration.
 * - `children.type` is the TypeDeclNode of the new name.
 * - `name` is the new typedef identifier.
 * - `quals` is a string array of type qualifiers (empty if none).
 * - `storage` is a string array, typically `["typedef"]`.
 */
export interface TypedefNode {
  _nodetype: "Typedef";

  children?: {
    type: TypeDeclNode;
  };

  name: string;
  quals: string[];
  storage: string[];
}

/**
 * A `(typename) expr` node representing an explicit typename cast.
 * - `name` is always null since we never store an identifier here.
 * - `quals` is a string array of qualifiers (empty if none).
 * - `align` is always null for Typename.
 * - `children.type` is a PtrDecl or TypeDecl.
 */
export interface TypenameNode {
  _nodetype: "Typename";

  align: null;

  children?: {
    type: PtrDeclNode | TypeDeclNode;
  };

  name: null;
  quals: string[];
}

/**
 * A unary operation, e.g. `!x`, `-x`, or `sizeof x`.
 * - `op` is the operator string (`"!"`, `"-"`, `"sizeof"`, etc.).
 * - `children.expr` is the operand (ArrayRef, BinaryOp, Constant, ID, StructRef, or Typename).
 */
export interface UnaryOpNode {
  _nodetype: "UnaryOp";

  children?: {
    expr: ArrayRefNode | BinaryOpNode | ConstantNode | IDNode | StructRefNode | TypenameNode;
  };

  op: string;
}

/**
 * A `union { ... };` declaration.
 * `children.decls` is an array of DeclNode for each member.
 * `name` is always null for anonymous unions in our AST.
 */
export interface UnionNode {
  _nodetype: "Union";

  children?: {
    decls: DeclNode[];
  };

  name: null;
}

/**
 * A `while (cond) stmt` loop.
 * - `cond` is a Constant or BinaryOp.
 * - `stmt` is the loop body (Compound).
 */
export interface WhileNode {
  _nodetype: "While";

  children?: {
    cond: BinaryOpNode | ConstantNode;
    stmt: CompoundNode;
  };
}

/** List of all valid `_nodetype` string literals. */
const KNOWN_NODE_TYPES = new Set<string>([
  "ArrayDecl",
  "ArrayRef",
  "Assignment",
  "BinaryOp",
  "Break",
  "Case",
  "Cast",
  "Compound",
  "Constant",
  "Decl",
  "Default",
  "DoWhile",
  "EllipsisParam",
  "EmptyStatement",
  "ExprList",
  "FileAST",
  "For",
  "FuncCall",
  "FuncDecl",
  "FuncDef",
  "Goto",
  "ID",
  "IdentifierType",
  "If",
  "InitList",
  "Label",
  "ParamList",
  "PtrDecl",
  "Return",
  "Struct",
  "StructRef",
  "Switch",
  "TernaryOp",
  "TypeDecl",
  "Typedef",
  "Typename",
  "UnaryOp",
  "Union",
  "While",
]);

interface ValidationError {
  message: string;
  path: string;
}

/**
 * Recursively checks that a parsed JSON object matches the ASTNodeJSON schema.
 * Usage:
 *   const validator = new ASTValidator();
 *   validator.validate(someJson); // throws if invalid
 */
export class ASTValidator {
  private errors: ValidationError[] = [];

  /** Return all accumulated validation errors (empty if none). */
  public getErrors(): ValidationError[] {
    return this.errors;
  }

  /**
   * Validate a parsed JSON object against the ASTNodeJSON schema.
   * @param obj  The JSON‐parsed object to validate.
   * @returns    `true` if valid, otherwise throws an Error listing all mismatches.
   */
  public validate(obj: unknown): obj is ASTNodeJSON {
    this.errors = [];
    this.checkNode(obj, "root");
    if (this.errors.length > 0) {
      const msg = this.errors.map((e, i) => `${String(i + 1)}. [${e.path}] ${e.message}`).join("\n");
      throw new Error("AST validation failed:\n" + msg);
    }
    return true;
  }

  /** Internal: validate the `children` property. */
  private checkChildren(value: unknown, path: string): void {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      this.reportError(path, "Expected `children` to be an object");
      return;
    }
    const children = value as Record<string, unknown>;
    for (const [childKey, childVal] of Object.entries(children)) {
      const childPath = `${path}.${childKey}`;
      if (Array.isArray(childVal)) {
        // Must be a non‐empty array of AST nodes
        if (childVal.length === 0) {
          this.reportError(childPath, "Expected at least one child node");
          continue;
        }
        for (let i = 0; i < childVal.length; i++) {
          // Wrap i in String(...) so we’re not interpolating a raw number
          this.checkNode(childVal[i], `${childPath}[${String(i)}]`);
        }
      } else {
        // Single node object
        this.checkNode(childVal, childPath);
      }
    }
  }

  /** Internal: validate that `value` is a valid ASTNodeJSON at the given path. */
  private checkNode(value: unknown, path: string): void {
    if (typeof value !== "object" || value === null) {
      this.reportError(path, "Expected an object for AST node");
      return;
    }
    const node = value as Record<string, unknown>;

    // 1) `_nodetype` must be a string in KNOWN_NODE_TYPES
    const nt = node._nodetype;
    if (typeof nt !== "string") {
      this.reportError(path + "._nodetype", "Missing or non‐string `_nodetype`");
      return;
    }
    if (!KNOWN_NODE_TYPES.has(nt)) {
      this.reportError(path + "._nodetype", `Unknown node type "${nt}"`);
      // Continue validating children/props even if nodetype is unrecognized
    }

    // 2) Iterate through all fields on the node
    for (const [key, val] of Object.entries(node)) {
      if (key === "_nodetype") {
        continue;
      }
      if (key === "children") {
        this.checkChildren(val, path + ".children");
      } else {
        // Primitive prop or string‐array prop
        this.checkPrimitiveProp(val, `${path}.${key}`);
      }
    }
  }

  /** Internal: validate an array of primitives (strings/numbers/booleans/null). */
  private checkPrimitiveArray(arr: unknown[], path: string): void {
    if (arr.length === 0) {
      // Empty array is allowed (e.g. `quals: []`)
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      const elem = arr[i];
      if (elem === null) {
        continue;
      }
      const t = typeof elem;
      if (t !== "string" && t !== "number" && t !== "boolean") {
        // Convert i to string explicitly
        this.reportError(`${path}[${String(i)}]`, `Expected primitive but got ${JSON.stringify(elem)}`);
      }
    }
  }

  /** Internal: validate “primitive” props (strings, numbers, booleans, null, or arrays thereof). */
  private checkPrimitiveProp(value: unknown, path: string): void {
    if (value === null) {
      return; // `null` is allowed
    }
    switch (typeof value) {
      case "boolean":
      case "number":
      case "string":
        return;
      case "object":
        if (Array.isArray(value)) {
          this.checkPrimitiveArray(value, path);
          return;
        }
        break;
    }
    this.reportError(path, `Invalid primitive value: ${JSON.stringify(value)}`);
  }

  /** Record a validation error at the given path. */
  private reportError(path: string, message: string): void {
    this.errors.push({ message, path });
  }
}
