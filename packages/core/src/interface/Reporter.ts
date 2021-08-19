import type { Parser } from "./Parser";
import type { Reader } from "./Reader";
import type { TypeChecker, TypedExpr } from "./TypeCheck";

export interface Reporter<I, O> {
    reportParserErrors(parser: Parser<any, any>, onError: () => void, depth?: number): void
    reportTypeErrors(tc: TypeChecker<O>, onError: () => void, depth?: number): void;
    formatTypeError(reader: Reader, expr1: TypedExpr, expr2: TypedExpr, msg?: string): any
    printFullReport(lexed: I, parsed: O, types: any[], result: any): void;
    printObject(result: object): void
}
