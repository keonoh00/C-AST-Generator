import { ICompoundStatement } from "./Block/CompoundStatement";
import { IBreakStatement } from "./ControlStructures/BreakStatement";
import { IContinueStatement } from "./ControlStructures/ContinueStatement";
import { IDoWhileStatement } from "./ControlStructures/DoWhileStatement";
import { IForStatement } from "./ControlStructures/ForStatement";
import { IGotoStatement } from "./ControlStructures/GotoStatement";
import { IIfStatement } from "./ControlStructures/IfStatement";
import { ILabel } from "./ControlStructures/Label";
import { IReturnStatement } from "./ControlStructures/ReturnStatement";
import { ISwitchCase } from "./ControlStructures/SwitchCase";
import { ISwitchStatement } from "./ControlStructures/SwitchStatement";
import { IWhileStatement } from "./ControlStructures/WhileStatement";
import { IEnumType } from "./DataTypes/EnumType";
import { IStructType } from "./DataTypes/StructType";
import { ITypeDefinition } from "./DataTypes/TypeDefinition";
import { IUnionType } from "./DataTypes/UnionType";
import { IAddressOfExpression } from "./Expressions/AddressOfExpression";
import { IArraySubscriptionExpression } from "./Expressions/ArraySubscriptExpression";
import { IAssignmentExpression } from "./Expressions/AssignmentExpression";
import { IBinaryExpression } from "./Expressions/BinaryExpression";
import { ICastExpression } from "./Expressions/CastExpression";
import { IIdentifier } from "./Expressions/Identifier";
import { ILiteral } from "./Expressions/Literal";
import { IMemberAccess } from "./Expressions/MemberAccess";
import { IPointerDereference } from "./Expressions/PointerDereference";
import { IUnaryExpression } from "./Expressions/UnaryExpression";
import { IIncludeDirective } from "./PreprocessorDirectives/IncludeDirective";
import { IMacroDefinition } from "./PreprocessorDirectives/MacroDefinition";
import { IArrayDeclaration } from "./ProgramStructures/ArrayDeclaration";
import { IFunctionDeclaration } from "./ProgramStructures/FunctionDeclaration";
import { IFunctionDefinition } from "./ProgramStructures/FunctionDefinition";
import { IParameterDeclaration } from "./ProgramStructures/ParameterDeclaration";
import { IParameterList } from "./ProgramStructures/ParameterList";
import { IPointerDeclaration } from "./ProgramStructures/PointerDeclaration";
import { ITranslationUnit } from "./ProgramStructures/TranslationUnit";
import { IVariableDeclaration } from "./ProgramStructures/VariableDeclaration";

export type ASTNodes = ASTBlockNodes | ASTControlStructureNodes | ASTExpressionNodes | ASTPreprocessorDirectiveNodes | ASTProgramStructureNodes;

type ASTBlockNodes = ICompoundStatement;

type ASTControlStructureNodes =
  | IBreakStatement
  | IContinueStatement
  | IDoWhileStatement
  | IEnumType
  | IForStatement
  | IGotoStatement
  | IIfStatement
  | ILabel
  | IReturnStatement
  | IStructType
  | ISwitchCase
  | ISwitchStatement
  | ITypeDefinition
  | IUnionType
  | IWhileStatement;

type ASTExpressionNodes =
  | IAddressOfExpression
  | IArraySubscriptionExpression
  | IAssignmentExpression
  | IBinaryExpression
  | ICastExpression
  | IIdentifier
  | ILiteral
  | IMemberAccess
  | IPointerDereference
  | IUnaryExpression;

type ASTPreprocessorDirectiveNodes = IIncludeDirective | IMacroDefinition;

type ASTProgramStructureNodes =
  | IArrayDeclaration
  | IFunctionDeclaration
  | IFunctionDefinition
  | IParameterDeclaration
  | IParameterList
  | IPointerDeclaration
  | ITranslationUnit
  | IVariableDeclaration;
