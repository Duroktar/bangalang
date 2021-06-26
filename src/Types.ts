import type { Ast } from "./Parser";
import type { Visitor } from "./Visitor";

export class TypeCheckError extends Error {}

export type WithType<T> = T & { type: TypeName }

export enum TypeName {
    STRING = 'string',
    NUMBER = 'number',
}

export interface TypeChecker extends Visitor {
    typecheck(ast: Ast): Ast
}
