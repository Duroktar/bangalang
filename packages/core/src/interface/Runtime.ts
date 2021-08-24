import type { Expression } from "../Ast";
import type { Interpreter } from "./Interpreter";
import type { IdentifierToken, Token } from "./Lexer";

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
    call(i: Interpreter, args: Expression[]): any
    toString(): string
    arity(): '...' | number
}

export type Environment = {
    assign(name: IdentifierToken, value: any): any
    define(name: string, value: any): any
    get(name: string): any
    has(name: string): any
    getAt(distance: number, name: string): any
    assignAt(distance: number, name: IdentifierToken, value: any): any
    clear(): any
    entries(): IterableIterator<[string, any]>
    values: Map<string, any>
    enclosing?: Environment
}
