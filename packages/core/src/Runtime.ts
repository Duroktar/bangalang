import { AstInterpreter } from "./lib/AstInterpreter";
import { AstNode } from "./Ast";
import { Token } from "./Lexer";

export class RuntimeError {
    constructor(
        public token: Token,
        public message: string,
    ) {}
}

export interface BangaCallable {
    checkArity(n: number): boolean
    call(v: AstInterpreter, args: AstNode[]): any
    toString(): string
    arity(): string | number
}

export type Environment = {
    [key: string]: BangaCallable;
}
