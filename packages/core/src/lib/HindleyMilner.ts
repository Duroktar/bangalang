import type * as Ast from '../Ast';
import { kindName } from '../Ast';
import { getToken, lineInfo, Token } from '../Lexer';
import { Reader } from '../Reader';
import { TypeChecker, TypeCheckError, TypeName } from '../Types';
import { format, UNREACHABLE, zip } from "./utils";


export type TyVar =
    | TypeVariable
    | TypeOperator


export type Scheme =
    | ForAll

export class TypeVariable {
    constructor(
        public readonly id: number,
        public instance?: TypeVariable,
        public name?: string,
        public label?: string,
    ) {}
}

export class TypeOperator {
    constructor(
        public readonly name: string,
        public readonly types: TyVar[] = [],
        public label?: string,
    ) {}
}

class ForAll {
    constructor(
        public tvars: TypeVariable[],
        public type: TyVar,
    ) {}
}

export const intType = new TypeOperator(TypeName.NUMBER)
export const strType = new TypeOperator(TypeName.STRING)
export const boolType = new TypeOperator(TypeName.BOOLEAN)
export const anyType = new TypeOperator(TypeName.ANY)
export const neverType = new TypeOperator(TypeName.NEVER)
export const FunctionType =
    (argType: TyVar, retType: TyVar) => new TypeOperator('=>', [argType, retType])

export class TypeEnv {
    constructor(
        public tc: HindleyMilner,
        public map: Record<string, TyVar> = { },
    ) { }
    get(name: string, nonGenerics: Set<TyVar>, label = true) {
        if (name in this.map)
            return this.tc.fresh(this.map[name], nonGenerics, label)
        throw 'undefined symbol: ' + name
    }
    extend(name: string, val: TyVar) {
        Object.assign(this.map, { [name]: val })
        // return new TypeEnv(this.tc, Object.assign({}, this.map, { [name]: val }))
    }
    copy() {
        return new TypeEnv(this.tc, Object.assign({}, this.map))
    }
}

export class HindleyMilner implements TypeChecker {
    constructor(
        public reader: Reader,
    ) {}

    public errors: TypeCheckError[] = []

    typecheck(ast: Ast.Program, env: TypeEnv) {
        let types: string[] = []
        for (let expr of ast) {
            if (expr == null)
                continue;
            types.push(this.tryExpr(expr, env))
        }
        return types
    }

    tryExpr(term: Ast.AstNode, env: TypeEnv) {
        try {
            let t = this.analyze(term, env)
            return this.typeToString(t)
        } catch (err) {
            if (err instanceof TypeCheckError) {
                this.errors.push(err)
                return TypeName.NEVER
            }
            throw err
        }
    }

    analyze(term: Ast.AstNode, env: TypeEnv): TyVar {
        let analyzeRec = (term: Ast.AstNode, env: TypeEnv, nonGenerics: Set<TyVar>): TyVar => {
            if (term.kind === 'VariableExpr') {
                const type = this.getType(term.name, env, nonGenerics, getToken(term))
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'ExpressionStmt') {
                const type = analyzeRec(term.expr, env, nonGenerics)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'GroupingExpr') {
                const type = analyzeRec(term.expr, env, nonGenerics)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'BinaryExpr') {
                let left = analyzeRec(term.left, env, nonGenerics)
                let right = analyzeRec(term.right, env, nonGenerics)
                this.unify(left, right, term)
                Object.assign(term, { type: left })
                return left
            }
            if (term.kind === 'AssignExpr') {
                let type = this.getType(term.name.value, env, nonGenerics, getToken(term))
                let body = analyzeRec(term.value, env, nonGenerics)
                this.unify(type, body, term)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'LetDeclaration') {
                let type = analyzeRec(term.init, env, nonGenerics)
                env.extend(term.name.value, type)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'LiteralExpr') {
                const type = this.getLiteralType(term, env, nonGenerics)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'FuncDeclaration') {
                const newEnv = env.copy()
                const newNonGenerics = new Set(nonGenerics.keys())
                term.params.forEach(t => {
                    const argType = this.mkVariable();
                    argType.label = t.value
                    newEnv.extend(t.value, argType)
                    newNonGenerics.add(argType)
                })
                const resultType = analyzeRec(term.body, newEnv, newNonGenerics)
                const argType = newEnv.get(term.params[0].value, nonGenerics)
                const funcType = FunctionType(argType, resultType)
                env.extend(term.name.value, funcType)
                return Object.assign(term, { type: funcType }).type
            }
            if (term.kind === 'CallExpr') {
                let funcType = analyzeRec(term.callee, env, nonGenerics);
                let argType = analyzeRec(term.args[0], env, nonGenerics);
                let retType = this.mkVariable();
                this.unify(FunctionType(argType, retType), funcType, term);
                Object.assign(term, { type: funcType }).type;
                return retType;
            }
            if (term.kind === 'ReturnStmt') {
                const type = analyzeRec(term.value, env, nonGenerics)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'BlockStmt') {
                const type = term.stmts
                    .map(stmt => analyzeRec(stmt, env, nonGenerics))
                    .pop()!
                return Object.assign(term, { type }).type
            }

            return UNREACHABLE(term, new Error('unreachable: analyze -> ' + (<any>term).kind))
        }
        return analyzeRec(term, env, new Set())
    }

    unify(t1: TyVar, t2: TyVar, term: Ast.Expression | Ast.Statement): void {
        let pt1 = this.prune(t1)
        let pt2 = this.prune(t2)
        if (pt1 instanceof TypeVariable) {
            if (pt1 !== pt2) {
                if (this.occursInType(pt1, pt2)) {
                    throw this.error('recursive unification', getToken(term))
                }
                pt1.instance = <TypeVariable>pt2
            }
        }
        else if (pt1 instanceof TypeOperator && pt2 instanceof TypeVariable) {
            this.unify(pt2, pt1, term)
        }
        else if (pt1 instanceof TypeOperator && pt2 instanceof TypeOperator) {
            if (pt1.name !== pt2.name || pt1.types.length !== pt2.types.length) {
                this.handleTypeOperatorsUnificationError(pt1, pt2, term)
            }
            zip(pt1.types, pt2.types).forEach(([t1, t2]) => this.unify(t1, t2, term))
        }
    }

    handleTypeOperatorsUnificationError(
        pt1: TypeOperator,
        pt2: TypeOperator,
        term: Ast.Expression | Ast.Statement,
    ) {
        const { start } = lineInfo(term);
        switch(term.kind) {
            case 'CallExpr': {
                const msg = "Can't assign argument of type '{0}' to parameter '{4}' of type '{1}' in function '{5}'; Ln {2}, Col {3}";
                const args = [pt1.name, pt2.name, start.line, start.col, pt2.label ?? this.typeToString(pt2), term.callee.toString()];
                throw this.error(format(msg, ...args), getToken(term.args[0]))
            }
            case 'BinaryExpr':
            case 'AssignExpr':
            default: {
                const msg = 'Type mismatch: {0} != {1}; Ln {2}, Col {3}';
                const args = [pt1.name, pt2.name, start.line, start.col];
                throw this.error(format(msg, ...args), getToken(term))
            }
        }
    }

    occursInTypes(type: TypeVariable, types: TyVar[]) {
        return types.some(t => this.occursInType(type, t))
    }

    occursInType(type: TypeVariable, typeIn: TyVar): boolean {
        typeIn = this.prune(typeIn)
        if (typeIn === type)
            return true
        return (typeIn instanceof TypeOperator) && this.occursInTypes(type, typeIn.types)
    }

    getLiteralType(term: Ast.LiteralExpr, env: TypeEnv, nonGenerics: Set<TyVar>): TyVar {
        switch (typeof term.value) {
            case 'string':   return strType;
            case 'number':   return intType;
            case 'boolean':  return boolType;
            default: {
                throw new Error('Unknown literal type: ' + term.raw)
            }
        }
    }

    getType(name: string, env: TypeEnv, nonGenerics: Set<TyVar>, token: Token): TyVar {
        const fromEnv = env.get(name, nonGenerics)
        if (fromEnv != undefined)
            return this.fresh(fromEnv, nonGenerics)
        throw this.error(`Undefined symbol ${name}`, token)
    }

    fresh(type: TyVar, nonGeneric: Set<TyVar>, label = true): TyVar {
        const table = new WeakMap<TyVar, TyVar>()

        const freshRec = (type: TyVar): TyVar => {
            type = this.prune(type)
            if (type instanceof TypeVariable) {
                if (this.isGeneric(type, nonGeneric)) {
                    if (!table.has(type))
                        table.set(type, this.mkVariable())
                    return table.get(type)!
                }
                return type
            }

            if (type instanceof TypeOperator) {
                // return new TypeOperator(type.name, type.types.map(freshRec))
                return new TypeOperator(type.name, type.types.map(freshRec), label ? type.label : undefined)
            }

            return UNREACHABLE(type, new Error(`Unreachable in 'fresh'`))
        }

        return freshRec(type)
    }

    isGeneric(type: TypeVariable, nonGenerics: Set<TyVar>): boolean {
        // throw new Error("Method not implemented: isGeneric.")
        return !this.occursInTypes(type, Array.from(nonGenerics));
    }

    prune(tp: TyVar): TyVar {
        if (tp instanceof TypeVariable && tp.instance) {
            let newInstance = this.prune(tp.instance)
            tp.instance = <TypeVariable>newInstance
            newInstance.label = tp.label
            return newInstance
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
                return format('{0} {1} {2}',
                    this.typeToString(t.types[0]),
                    t.name,
                    this.typeToString(t.types[1]),
                )
            }
            const typenames = t.types
                .map(t => this.typeToString(t))

            return `${t.name} ${typenames.join(' ')}`
        }

        return UNREACHABLE(t, this.error('Unreachable typeToString: ' + t))
    }

    variableName(t: TypeVariable): string {
        if (t.name) return t.name
        t.name = this._next_unique_name;
        this._next_unique_name = this.mkVariableName()
        return t.name
    }

    private error(msg: string, token?: Token) {
        return new TypeCheckError(msg, token)
    }

    private _next_variable_id = 0
    private _next_unique_name = 'a'

    private mkVariableName = (): string =>
        String.fromCharCode(this._next_unique_name.charCodeAt(0) + 1)

    private mkVariable = (): TypeVariable =>
        new TypeVariable(this._next_variable_id++)
}

export type BuiltinTypes = typeof GlobalTypes;

export const GlobalTypes: Record<string, TyVar> = {
    print: FunctionType(strType, intType)
}

// function tokenToString(expr: Token) {
//     if (expr instanceof Ast.LiteralExpr) {
//         return expr.token
//     }

//     if (expr instanceof Ast.BinaryExpr) {
//         return newWithLineInfo(expr.op, {
//             start: getToken(expr.left).lineInfo.start,
//             end: getToken(expr.right).lineInfo.end,
//         })
//     }

//     if (expr instanceof Ast.VariableExpr) {
//         return expr.token
//     }

//     if (expr instanceof Ast.AssignExpr) {
//         return expr.name
//     }

//     if (expr instanceof Ast.GroupingExpr) {
//         return expr.token
//     }

//     if (expr instanceof Ast.LetDeclaration) {
//         return expr.name
//     }

//     if (expr instanceof Ast.ExpressionStmt) {
//         return expr.token
//     }

//     if (expr instanceof Ast.CallExpr) {
//         return expr.paren
//     }

//     if (expr instanceof Ast.FuncDeclaration) {
//         return expr.name
//     }

//     if (expr instanceof Ast.BlockStmt) {
//         return getToken(expr.stmts[0])
//     }

//     throw new Error('No token found for: ' + UNREACHABLE(expr))
// }    
