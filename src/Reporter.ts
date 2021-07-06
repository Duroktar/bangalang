import type { Token } from "./Lexer";
import type { Program } from "./Ast";
import type { TypeChecker, WithType } from "./Types";

export interface Reporter {
    printFullReport(tokens: Token[], ast: Program, types: WithType<Program[number]>[], result: any): void;
    reportTypeErrors(tc: TypeChecker, cb: () => void, depth?: number): void;
}
