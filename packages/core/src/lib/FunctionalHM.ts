import type * as Ast from '../Ast';
import { getToken, lineInfo, Token } from '../interface/Lexer';
import { TypeCheckError, TypeName } from '../interface/TypeCheck';
import { format, UNREACHABLE, zip } from "./utils";

function error(msg: string, token: Token) {
    return new TypeCheckError(msg, token)
}

type TyVar =
    | TypeVariable
    | TypeOperator


type Scheme =
    | ForAll


class TypeVariable {
    constructor(
        public instance?: TypeVariable,
        public label?: string,
    ) {}

    get name() {
        if (this.__name === undefined) {
            this.__name = TypeVariable.NextVariableId
            TypeVariable.NextVariableId = String
                .fromCharCode(this.__name.charCodeAt(0) + 1)
        }
        return this.__name
    }

    toString(): string {
        return this.instance
            ? this.instance.toString()
            : this.name
    }

    static NextVariableId = 'a'

    private __name?: string
}

class TypeOperator {
    constructor(
        public readonly name: string,
        public readonly types: TyVar[] = [],
    ) {}

    toString(): string {
        const { length } = this.types
        if (length === 0)
            return this.name
        if (length === 2)
            return format('{0} {1} {2}',
                this.types[0].toString(),
                this.name,
                this.types[1].toString(),
            )
        else {
            const types = this.types.join(' ');
            return `${this.name} ${types}`
        }
    }
}

class Function extends TypeOperator {
    constructor(
        public argType: TyVar,
        public retType: TyVar,
    ) {
        super('=>', [argType, retType])
    }
}

class ForAll {
    constructor(
        public tvars: TypeVariable[],
        public type: TyVar,
    ) {}
}


const intType = new TypeOperator(TypeName.NUMBER)
const strType = new TypeOperator(TypeName.STRING)
const boolType = new TypeOperator(TypeName.BOOLEAN)
const neverType = new TypeOperator(TypeName.NEVER)
const anyType = new TypeOperator(TypeName.ANY)


export class TypeEnv {
    constructor(
        public map: Record<string, TyVar> = { },
    ) { }
    get(name: string, nonGeneric: Set<TyVar>) {
        if (name in this.map)
            return fresh(this.map[name], nonGeneric)
        throw '[TypeEnv]: Undefined symbol: ' + name
    }
    extend(name: string, val: TyVar) {
        Object.assign(this.map, { [name]: val })
    }
    copy() {
        return new TypeEnv(Object.assign({}, this.map))
    }
}


let analyze: (a: Ast.AstNode, b: TypeEnv, c?: Set<TyVar>) => TyVar
    = (term, env, nonGeneric = new Set()) => {
    if (term.kind === 'VariableExpr') {
        const type = env.get(term.name, nonGeneric)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'ExpressionStmt') {
        const type = analyze(term.expr, env, nonGeneric)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'GroupingExpr') {
        const type = analyze(term.expr, env, nonGeneric)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'BinaryExpr') {
        let left = analyze(term.left, env, nonGeneric)
        let right = analyze(term.right, env, nonGeneric)
        unify(left, right, term)
        Object.assign(term, { type: left })
        return left
    }
    if (term.kind === 'AssignExpr') {
        let type = env.get(term.name.value, nonGeneric)
        let body = analyze(term.value, env, nonGeneric)
        unify(type, body, term)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'LetDeclaration') {
        let type = analyze(term.init, env, nonGeneric)
        env.extend(term.name.value, type)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'LiteralExpr') {
        const type = getLiteralType(term, env, nonGeneric)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'FuncDeclaration') {
        const newEnv = env.copy()
        const newNonGenerics = new Set(nonGeneric.keys())
        term.params.forEach(t => {
            const argType = new TypeVariable();
            argType.label = t.value
            newEnv.extend(t.value, argType)
            newNonGenerics.add(argType)
        })
        const resultType = analyzeFuncBody(term.body, newEnv, newNonGenerics)
        const argType = newEnv.get(term.params[0].value, nonGeneric)
        const funcType = new Function(argType, resultType)
        env.extend(term.name.value, funcType)
        return Object.assign(term, { type: funcType }).type
    }
    if (term.kind === 'CallExpr') {
        let funcType = analyze(term.callee, env, nonGeneric);
        let argType = analyze(term.args[0], env, nonGeneric);
        let retType = new TypeVariable();
        unify(new Function(argType, retType), funcType, term);
        Object.assign(term, { type: funcType }).type;
        return retType;
    }
    if (term.kind === 'ReturnStmt') {
        const type = analyze(term.value, env, nonGeneric)
        return Object.assign(term, { type }).type
    }
    if (term.kind === 'BlockStmt') {
        term.stmts.forEach(stmt => analyze(stmt, env, nonGeneric))
        return Object.assign(term, { type: neverType }).type
    }
    if (term.kind === 'CaseExpr') {
        throw new Error('Not implemented: "CaseExpr" in analyzeRec')
    }
    if (term.kind === 'IfExprStmt') {
        throw new Error('Not implemented: "IfExpr" in analyzeRec')
    }
    if (term.kind === 'ClassDeclaration') {
        throw new Error('Not implemented: "ClassDeclaration" in analyzeRec')
    }

    return UNREACHABLE(term, new Error('unreachable: analyze -> ' + (<any>term).kind))
}

function analyzeFuncBody(
    term: Ast.BlockStmt,
    env: TypeEnv,
    nonGeneric: Set<TyVar>,
): TyVar {
    const newType = new TypeVariable();
    term.stmts
        .map(stmt => ({ stmt, t: analyze(stmt, env, nonGeneric) }))
        .filter(o => o.stmt.kind === 'ReturnStmt')
        .forEach(o => unify(newType, o.t, o.stmt))
    return Object.assign(term, { type: newType }).type
}

function fresh(type: TyVar, nonGeneric: Set<TyVar>): TyVar {
    const mappings = new WeakMap<TyVar, TyVar>()

    const freshRec = (type: TyVar): TyVar => {
        const p = prune(type)
        if (p instanceof TypeVariable) {
            if (isGeneric(p, nonGeneric)) {
                if (!mappings.has(p))
                    mappings.set(p, new TypeVariable())
                return mappings.get(p)!
            } else
                return p
        }

        else if (p instanceof TypeOperator)
            return new TypeOperator(p.name, p.types.map(freshRec))

        return UNREACHABLE(p, new Error(`Unreachable in 'fresh'`))
    }

    return freshRec(type)
}

function unify(t1: TyVar, t2: TyVar, term: Ast.Expression | Ast.Statement): void {
    const a = prune(t1)
    const b = prune(t2)
    if (a instanceof TypeVariable) {
        if (a !== b) {
            if (occursInType(a, b))
                throw error('recursive unification', getToken(term))
            a.instance = <TypeVariable>b
        }
    }
    else if (a instanceof TypeOperator && b instanceof TypeVariable)
        unify(b, a, term)
    else if (a instanceof TypeOperator && b instanceof TypeOperator) {
        if (a.name !== b.name || a.types.length !== b.types.length)
            throw handleTypeOperatorsUnificationError(a, b, term)
        zip(a.types, b.types).forEach(([t1, t2]) => unify(t1, t2, term))
    } else {
        throw error('Not unified', getToken(term))
    }
}

function prune(tp: TyVar): TyVar {
    if (tp instanceof TypeVariable && tp.instance) {
        let newInstance = prune(tp.instance)
        tp.instance = <TypeVariable>newInstance
        return newInstance
    }
    return tp
}

function isGeneric(type: TypeVariable, nonGenerics: Set<TyVar>): boolean {
    return !occursIn(type, Array.from(nonGenerics));
}

function occursInType(v: TypeVariable, type: TyVar): boolean {
    type = prune(type)
    if (type === v)
        return true
    if (type instanceof TypeOperator)
        return occursIn(v, type.types)
    return false
}

function occursIn(type: TypeVariable, types: TyVar[]) {
    return types.some(t => occursInType(type, t))
}

function getLiteralType(term: Ast.LiteralExpr, env: TypeEnv, nonGenerics: Set<TyVar>): TyVar {
    switch (typeof term.value) {
        case 'string':   return strType;
        case 'number':   return intType;
        case 'boolean':  return boolType;
        default: {
            throw new Error('Unknown literal type: ' + term.raw)
        }
    }
}

function handleTypeOperatorsUnificationError(
    type1: TypeOperator,
    type2: TypeOperator,
    term: Ast.Expression | Ast.Statement,
): TypeCheckError {
    const { start } = lineInfo(term);
    switch(term.kind) {
        case 'CallExpr': {
            const template = [
                "Can't assign arg of type '{0}' to param",
                "'{1}' of type '{2}' in function '{3}';",
                "Ln {4}, Col {5}"
            ].join(" ");
            const args = [
                type1.name, type2.toString(),
                type2.name, term.callee.toString(),
                start.line, start.col,
            ];
            const token = getToken(term.args[0]);
            const msg = format(template, ...args);
            return error(msg, token)
        }
        case 'BinaryExpr':
        case 'AssignExpr':
        default: {
            const template = [
                "Type mismatch: {0} != {1};",
                "Ln {2}, Col {3}"
            ].join(" ");
            const args = [
                type1.name, type2.name,
                start.line, start.col,
            ];
            const msg = format(template, ...args);
            const token = getToken(term);
            return error(msg, token)
        }
    }
}

export function tryExpr(term: Ast.AstNode, env: TypeEnv) {
    try {
        const t = analyze(term, env)
        return t.toString()
    } catch (err) {
        if (err instanceof TypeCheckError)
            console.error(err)
        else
            throw err
    }
}

export const TypeLib = {
    print: new Function(new TypeVariable(), intType),
    true: boolType,
    false: boolType,
}
