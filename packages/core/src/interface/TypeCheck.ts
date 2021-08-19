import type { Expression, Program } from "../Ast";
import type { Range, Token } from "./Lexer";
import type { TyVar } from "../lib/HindleyMilner";

export class TypeCheckError {
    constructor(
        public message: string,
        public token: Token,
        public range?: Range,
    ) {}
}


export enum TypeName {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    NEVER = 'never',
    ANY = 'any',
}

export type WithType<T> = T & { type: TypeName }
export type Typed<T> = T & { type: TyVar }

export type TypedExpr = WithType<Expression>;

export interface TypeChecker<I> {
    validate(program: I): any
    errors: TypeCheckError[]
}
