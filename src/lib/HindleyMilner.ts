import type * as Ast from '../Ast';
import { Reader } from '../Reader';
import { TypeChecker, TypeCheckError } from '../Types';
import { lineInfo } from "./ConsoleReporter";
import { format, formatTypeError, UNREACHABLE, zip } from "./utils";

type Env = Record<string, TyVar>

type TyVar =
    | TypeVariable
    | TypeOperator

class TypeVariable {
    constructor(
        public readonly id: number,
        public instance?: TypeVariable,
        public name?: string,
    ) {}
}

class TypeOperator {
    constructor(
        public readonly name: string,
        public readonly types: TyVar[],
    ) {}
}

let _next_variable_id = 0
let _next_unique_name = 'a'

export const mkVariableName = (): string =>
    String.fromCharCode(_next_unique_name.charCodeAt(0) + 1)

export const mkVariable = (): TypeVariable =>
    new TypeVariable(_next_variable_id++)

export const intType = new TypeOperator("int", [])
export const strType = new TypeOperator("str", [])
export const boolType = new TypeOperator("bool", [])

export class HindleyMilner implements TypeChecker {
    constructor(public reader: Reader) {}

    public errors: TypeCheckError[] = []

    typecheck(ast: Ast.Program, env: Env = {}) {
        let types: string[] = []
        for (let expr of ast) {
            types.push(this.tryExpr(expr, env))
        }
        return types
    }

    tryExpr(term: Ast.Statement, env: Env) {
        try {
            let t = this.analyze(term, env)
            return this.typeToString(t)
        } catch (err) {
            this.errors.push(err)
            return 'never'
        }
    }

    analyze(term: Ast.Statement | Ast.Expression, env: Env): TyVar {
        let analyzeRec = (term: Ast.Statement | Ast.Expression, env: Env, nonGeneric: unknown): TyVar => {
            if (term.kind === 'VariableExpr') {
                const type = this.getType(term.name, env, nonGeneric)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'ExpressionStmt') {
                const type = analyzeRec(term.expr, env, nonGeneric)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'GroupingExpr') {
                const type = analyzeRec(term.expr, env, nonGeneric)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'BinaryExpr') {
                let left = analyzeRec(term.left, env, nonGeneric)
                let right = analyzeRec(term.right, env, nonGeneric)
                this.unify(left, right, term)
                return Object.assign(term, { type: left }).type
            }
            if (term.kind === 'AssignExpr') {
                let name = this.getType(term.name.value, env, nonGeneric)
                let body = analyzeRec(term.value, env, nonGeneric)
                this.unify(name, body, term)
                return Object.assign(term, { type: name }).type
            }
            if (term.kind === 'LetDeclaration') {
                let type = analyzeRec(term.init, env, nonGeneric)
                env[term.name.value] = type
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'LiteralExpr') {
                const type = this.getLiteralType(term, env, nonGeneric)
                return Object.assign(term, { type }).type
            }

            UNREACHABLE(term)

            throw new Error('unreachable: analyze -> ' + (<any>term).kind)
        }
        return analyzeRec(term, env, void 0)
    }

    unify(t1: TyVar, t2: TyVar, term: Ast.Expression | Ast.Statement): void {
        let pt1 = this.prune(t1)
        let pt2 = this.prune(t2)
        if (pt1 instanceof TypeVariable) {
            if (pt1 !== pt2) {
                if (this.occursInType(pt1, pt2)) {
                    throw new TypeCheckError('recursive unification')
                }
                pt1.instance = <TypeVariable>pt2
            }
        }
        else if (pt1 instanceof TypeOperator && pt2 instanceof TypeVariable) {
            this.unify(pt2, pt1, term)
        }
        else if (pt1 instanceof TypeOperator && pt2 instanceof TypeOperator) {
            if (pt1.name !== pt2.name || pt1.types.length !== pt2.types.length) {
                const { start } = lineInfo(term);
                const msg = 'Type mismatch: {0} != {1}; Ln {2}, Col {3}';
                const args = [pt1.name, pt2.name, start.line, start.col];
                throw new TypeCheckError(format(msg, ...args))
            }
            zip(pt1.types, pt2.types).forEach(([t1, t2]) => this.unify(t1, t2, term))
        }
    }

    occursInType(v: TypeVariable, t2: TyVar): boolean {
        const occursIn = (t: TypeVariable, types: TyVar[]) =>
            types.some(t2 => this.occursInType(t, t2))

        const pt2 = this.prune(t2)

        return (pt2 instanceof TypeOperator) && occursIn(v, pt2.types)
    }

    getLiteralType(term: Ast.LiteralExpr, env: Env, nonGeneric: unknown): TyVar {
        switch (typeof term.value) {
            case 'string':   return strType;
            case 'number':   return intType;
            case 'boolean':  return boolType;
            default: {
                throw new TypeCheckError('Unknown literal type: ' + term.raw)
            }
        }
    }

    getType(name: string, env: Env, nonGeneric: unknown): TyVar {
        const fromEnv = env[name]
        if (fromEnv != undefined)
            return this.fresh(fromEnv, nonGeneric)
        throw new TypeCheckError(`Undefined symbol ${name}`)
    }

    fresh(type: TyVar, nonGeneric: unknown): TyVar {
        const table = new Map<TyVar, TyVar>()
        const freshRec = (tp: TyVar): TyVar => {
            const p = this.prune(tp)
            if (p instanceof TypeVariable) {
                if (this.isGeneric(p, nonGeneric)) {
                    if (!table.has(p)) {
                        let newVar = mkVariable()
                        table.set(p, newVar)
                        return newVar
                    }
                    return table.get(p)!
                }
                return p
            }
            if (p instanceof TypeOperator) {
                return new TypeOperator(
                    p.name,
                    p.types.map(t => freshRec(t))
                )
            }
            throw new TypeCheckError(`Unreachable 'fresh'`)
        }
        return freshRec(type)
    }

    isGeneric(t: TyVar, nonGeneric: unknown): boolean {
        throw new Error("Method not implemented: isGeneric.")
    }

    prune(tp: TyVar): TyVar {
        if (tp instanceof TypeVariable) {
            if (tp.instance instanceof TypeVariable) {
                let newInstance = this.prune(tp.instance)
                tp.instance = <TypeVariable>newInstance
                return newInstance
            }
        }
        return tp
    }

    typeToString(t: TyVar): string {
        if (t instanceof TypeVariable) {
            if (t.instance instanceof TypeVariable) {
                return this.typeToString(t.instance)
            }
            return this.variableName(t)
        }
        if (t instanceof TypeOperator) {
            const length = t.types.length
            if (length === 0)
                return t.name
            if (length === 2) {
                return format('({0} {1} {2})',
                    this.typeToString(t.types[0]),
                    t.name,
                    this.typeToString(t.types[1]),
                )
            }
            return t.types.map(t => this.typeToString(t)).join(' ')
        }
        throw new TypeCheckError('Unreachable typeToString: ' + t)
    }

    variableName(t: TypeVariable): string {
        if (t.name) return t.name
        t.name = _next_unique_name;
        _next_unique_name = mkVariableName()
        return t.name
    }

    termToString(term: any): string {
        switch (term.kind) {
            case 'ExpressionStmt':
                return this.termToString(term.expr)
            case 'VariableExpr':
                return term.name
            case 'LiteralExpr':
                return term.value
            case 'LetDeclaration':
                return term.name.value
            default: {
                let msg = 'Unreachable termToString: '
                throw new TypeError(msg + term.kind)
            }
        }
    }
}
