import type { Range, Token } from "./Lexer";

export class ParserError {
    constructor(
        public message: string,
        public token: Token,
        public range?: Range,
    ) { }
}

export interface Parser<I, O> {
    errors: ParserError[]
    parse(tokens: I): O
}
