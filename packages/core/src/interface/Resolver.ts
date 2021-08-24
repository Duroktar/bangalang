import { Token } from "./Lexer";
import { Visitor } from "./Visitor";

export class ResolutionError {
    constructor(
        public token: Token,
        public message: string,
    ) {}
}

export interface Resolver<I> extends Visitor {
    resolve(program: I): any
    errors: ResolutionError[]
}
