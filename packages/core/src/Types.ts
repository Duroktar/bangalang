import type { Program, Expression } from "./Ast";
import type { Token } from "./Lexer";

export class TypeCheckError {
    constructor(
        public message: string,
        public token?: Token,
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

export type TypedExpr = WithType<Expression>;

export interface TypeChecker {
    typecheck(ast: Program): any
    errors: TypeCheckError[]
}
