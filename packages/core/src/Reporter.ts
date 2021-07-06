import type * as Ast from "./Ast";
import type { Token } from "./Lexer";
import type { TypeChecker, TypedExpr, WithType } from "./Types";
import type { Parser } from "./Parser";
import type { Reader } from "./Reader";

export interface Reporter {
    printFullReport(tokens: Token[], ast: Ast.Program, types: any[], result: any): void;
    reportTypeErrors(tc: TypeChecker, cb: () => void, depth?: number): void;
    printObject(result: object): void
    reportParserErrors(parser: Parser<any, any>, onError: () => void, depth: number): void
    formatTypeError(reader: Reader, expr1: TypedExpr, expr2: TypedExpr, msg?: string): string
}
