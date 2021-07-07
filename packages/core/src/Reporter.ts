import type * as Ast from "./Ast";
import type { Token } from "./Lexer";
import type { TypeChecker, TypedExpr } from "./Types";
import type { Parser } from "./Parser";
import type { Reader } from "./Reader";

export interface Reporter {
    reportParserErrors(parser: Parser<any, any>, onError: () => void, depth: number): void
    reportTypeErrors(tc: TypeChecker, onError: () => void, depth?: number): void;
    formatTypeError(reader: Reader, expr1: TypedExpr, expr2: TypedExpr, msg?: string): any
    printFullReport(tokens: Token[], ast: Ast.Program, types: any[], result: any): void;
    printObject(result: object): void
}
