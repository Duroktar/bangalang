import type { Token } from "./Lexer";

export class ParserError {
    constructor(
        public message: string,
        public token: Token,
    ) { }
}

export interface Parser<I, O> {
    errors: ParserError[]
    input: I
    parseProgram(): O
}
