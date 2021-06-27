import type { Ast } from "./Parser";
import type { Visitor } from "./Visitor";

export class TypeCheckError {
    constructor(_msg: string | string[]) {
        this.message = !Array.isArray(_msg)
            ? _msg
            : _msg.join('\n')
    }
    public message: string;
}

export type WithType<T> = T & { type: TypeName }

export enum TypeName {
    STRING = 'string',
    NUMBER = 'number',
    NEVER = 'never',
}

export interface TypeChecker extends Visitor {
    typecheck(ast: Ast): Ast
    errors: TypeCheckError[]
}
