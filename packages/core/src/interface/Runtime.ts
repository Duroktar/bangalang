import { AstNode, Expression } from "../Ast";
import { Interpreter } from "./Interpreter";
import { Token } from "./Lexer";

export class RuntimeError {
    constructor(
        public token: Token,
        public message: string,
    ) {}
}

export class ReturnValue {
    constructor(public value: Expression | null) {}
}

export interface BangaCallable {
    checkArity(n: number): boolean
    call(i: Interpreter, args: AstNode[]): any
    toString(): string
    arity(): '...' | number
}

export type Environment = Map<string, any>
