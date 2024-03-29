import type * as Ast from '../Ast';
import { VariableExpr } from '../Ast';
import { getToken, lineInfo, Range, Token } from '../interface/Lexer';
import { Reader } from '../interface/Reader';
import { TypeChecker, TypeCheckError, Typed, TypeName } from '../interface/TypeCheck';
import { format, underline, UNREACHABLE, zip } from "./utils";

export type TyVar =
    | TypeVariable
    | TypeOperator
    | TypeTuple

export type Scheme =
    | ForAll

export class TypeVariable {
    public readonly type = 'TypeVariable'
    constructor(
        public readonly id: number,
        public instance?: TypeVariable,
        public name?: string,
        public label?: string,
        public docs?: string,
    ) {}
}

export class TypeOperator {
    public readonly type = 'TypeOperator'
    constructor(
        public readonly name: string,
        public readonly types: TyVar[] = [],
        public label?: string,
        public docs?: string,
    ) {}
}

export class TypeTuple {
    public readonly type = 'TypeTuple'
    constructor(
        public readonly types: TyVar[] = [],
        public variableLength: boolean = false,
        public label?: string,
        public docs?: string,
    ) {}
}

class ForAll {
    constructor(
        public tvars: TypeVariable[],
        public type: TyVar,
    ) {}
}

export const intType = () => new TypeOperator(TypeName.NUMBER)
export const strType = () => new TypeOperator(TypeName.STRING)
export const boolType = () => new TypeOperator(TypeName.BOOLEAN)
export const anyType = () => new TypeOperator(TypeName.ANY)
export const neverType = () => new TypeOperator(TypeName.NEVER)
export const FunctionType =
    (argType: TyVar, retType: TyVar) => new TypeOperator('=>', [argType, retType])
export const FunctionArgs =
    (argTypes: TyVar[], varrargs = false) => new TypeTuple(argTypes, varrargs)

export class TypeEnv {
    constructor(
        public map: Record<string, TyVar> = { },
    ) { }
    get(tc: HindleyMilner, name: string, nonGenerics: Set<TyVar>, token: Token, label = true) {
        if (name in this.map)
            return tc.fresh(this.map[name], nonGenerics, label)
        throw new TypeCheckError('Undefined symbol: ' + name, token)
    }
    extend(name: string, val: TyVar) {
        Object.assign(this.map, { [name]: val })
    }
    copy() {
        return new TypeEnv(Object.assign({}, this.map))
    }
}

export class HindleyMilner implements TypeChecker<Ast.Program> {
    constructor(
        public reader: Reader,
        public env: TypeEnv
    ) {}

    public errors: TypeCheckError[] = []

    validate = (ast: Ast.Program) => {
        let types: string[] = []
        for (let expr of ast) {
            if (expr == null)
                continue;
            types.push(this.tryExpr(expr, this.env))
        }
        return types
    }

    tryExpr = (term: Ast.AstNode, env: TypeEnv) => {
        try {
            let t = this.analyze(term, env)
            return this.typeToString(t)
        } catch (err) {
            if (err instanceof TypeCheckError) {
                this.errors.push(err)
                return TypeName.NEVER
            } else {
                throw err
            }
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
                env.extend(term.name.value, this.prune(type))
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'LiteralExpr') {
                const type = this.getLiteralType(term, env, nonGenerics)
                return Object.assign(term, { type }).type
            }
            if (term.kind === 'ClassDeclaration') {
                // const type = this.getLiteralType(term, env, nonGenerics)
                // return Object.assign(term, { type }).type
                return neverType()
            }
            if (term.kind === 'IfExprStmt') {
                // TODO: assert cond type is boolean (??)
                let cond = analyzeRec(term.cond, env, nonGenerics)
                this.unify(cond, boolType(), term)
                let pass = analyzeRec(term.pass, env, nonGenerics)
                let fail = analyzeRec(term.fail, env, nonGenerics)
                this.unify(pass, fail, term)
                Object.assign(term, { type: pass })
                return pass
            }
            if (term.kind === 'FuncDeclaration') {
                const closure = env.copy()
                const newNonGenerics = new Set(nonGenerics.keys())
                term.params.forEach(t => {
                    const argType = this.mkVariable()
                    argType.label = t.value
                    closure.extend(t.value, argType)
                    newNonGenerics.add(argType)
                })
                const retType = this.injectReturnTyVar(closure, newNonGenerics, term)
                const argTypes = term.params.map(item => closure.get(this, item.value, nonGenerics, item))
                try {
                    const resultType = analyzeRec(term.body, closure, newNonGenerics)
                    const funcType = FunctionType(FunctionArgs(argTypes, term.varargs), resultType)
                    env.extend(term.name.value, funcType)
                    return Object.assign(term, { type: funcType }).type
                } catch (err) {
                    const funcType = FunctionType(FunctionArgs(argTypes, term.varargs), retType)
                    env.extend(term.name.value, funcType)
                    Object.assign(term, { type: funcType }).type
                    throw err
                }
            }
            if (term.kind === 'CallExpr') {
                let funcType = analyzeRec(term.callee, env, nonGenerics)
                let argTypes = term.args.map(arg => analyzeRec(arg, env, nonGenerics))
                let retType = this.mkVariable()
                this.unify(FunctionType(FunctionArgs(argTypes), retType), funcType, term)
                Object.assign(term, { type: retType })
                return retType
            }
            if (term.kind === 'ReturnStmt') {
                const retType = this.getType('return', env, nonGenerics, getToken(term))
                const type = analyzeRec(term.value, env, nonGenerics)

                this.tryWithErr(
                    () => this.unify(type, retType, term),
                    () => this.getReturnTypeUnificationError(type, retType, term),
                )

                return Object.assign(term, { type }).type
            }
            if (term.kind === 'BlockStmt') {
                const type = term.stmts
                    .map(stmt => analyzeRec(stmt, env, nonGenerics))
                    .pop()
                return Object.assign(term, { type: type ?? neverType() }).type
            }
            if (term.kind === 'CaseExpr') {
                const exprT = analyzeRec(term.expr, env, nonGenerics)
                let rType: TyVar | undefined;
                term.cases.forEach(exprCase => {
                    const { matcher, ifMatch } = exprCase

                    const mType = (VariableExpr.is(matcher) && matcher.isUnderscore())
                        ? exprT
                        : analyzeRec(matcher, env, nonGenerics);

                    const resType = analyzeRec(ifMatch, env, nonGenerics)

                    this.tryWithErrMsg(
                        () => this.unify(mType, exprT, term),
                        () => this.getInvalidCaseOptionError(mType, exprT, rType ?? resType, matcher),
                        getToken(matcher))

                    if (rType === undefined) {
                        rType = resType
                    } else {
                        this.tryWithErrMsg(
                            () => this.unify(resType, rType!, term),
                            () => this.getInvalidCaseResultError(mType, resType, rType!, ifMatch),
                            getToken(ifMatch))
                    }
                })
                if (rType === undefined)
                    throw this.error('NO DEFAULT CASE ERROR', term.token)

                return Object.assign(term, { type: rType }).type
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
        else if (pt1 instanceof TypeTuple && pt2 instanceof TypeTuple) {
            if (pt1.types.length !== pt2.types.length) {
                if (!(pt1.variableLength)) {
                    if (pt2.variableLength) {
                        this.unify(pt2,  pt1, term)
                    } else {
                        throw this.getFunctionArgsUnificationError(pt1, pt2, term)
                    }
                } else {
                    let firstType = pt1.types[0];
                    pt2.types.forEach(t2 => this.unify(firstType, t2, term))
                }
            } else {
                zip(pt1.types, pt2.types).forEach(([t1, t2]) => this.unify(t1, t2, term))
            }
        }
        else if (pt1 instanceof TypeOperator && pt2 instanceof TypeOperator) {
            if (pt1.name !== pt2.name || pt1.types.length !== pt2.types.length) {
                throw this.getTypeOperatorsUnificationError(pt1, pt2, term)
            }
            zip(pt1.types, pt2.types).forEach(([t1, t2]) => this.unify(t1, t2, term))
        } else {
            const t1 = this.typeToString(pt1)
            const t2 = this.typeToString(pt2)
            throw this.error(`Can't unify terms: ${t1} ${t2}`, getToken(term))
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
            case 'string':   return strType();
            case 'number':   return intType();
            case 'boolean':  return boolType();
            default: {
                throw new Error('Unknown literal type: ' + term.raw)
            }
        }
    }

    getType(name: string, env: TypeEnv, nonGenerics: Set<TyVar>, token: Token): TyVar {
        const fromEnv = env.get(this, name, nonGenerics, token)
        if (fromEnv != undefined)
            return this.fresh(fromEnv, nonGenerics)
        throw this.error(`[getType]: Undefined symbol ${name}`, token)
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
                return new TypeOperator(type.name, type.types.map(freshRec), label ? type.label : undefined)
            }

            if (type instanceof TypeTuple) {
                return new TypeTuple(type.types.map(freshRec), type.variableLength, label ? type.label : undefined)
            }

            return UNREACHABLE(type, new Error(`Unreachable in 'fresh'`))
        }

        return freshRec(type)
    }

    isGeneric(type: TypeVariable, nonGenerics: Set<TyVar>): boolean {
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

    private injectReturnTyVar = (env: TypeEnv, gen: Set<TyVar>, term: Ast.FuncDeclaration) => {
        const retType = this.mkVariable()
        retType.label = term.name.value
        env.extend('return', retType)
        gen.add(retType)
        return retType
    }

    public typeToString(t: TyVar): string {
        t = this.prune(t)
        if (t instanceof TypeVariable) {
            if (t.instance instanceof TypeVariable) {
                return this.typeToString(t.instance)
            }
            return this.variableName(t)
        }
        if (t instanceof TypeTuple) {
            const typenames = t.types
                .map(tp => tp.label ? `${tp.label}: ${this.typeToString(tp)}` : this.typeToString(tp))

            if (t.variableLength)
                return `(...${typenames[typenames.length - 1]})`

            return `(${typenames.join(', ')})`
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

        return UNREACHABLE(t)
        // return UNREACHABLE(t, new Error('unreachable: typeToString -> ' + String(t)))
    }

    private variableName(t: TypeVariable): string {
        if (t.name) return t.name
        t.name = this._next_unique_name;
        this._next_unique_name = this.mkVariableName()
        return t.name
    }

    public nodeTypeToString = (node: Typed<Ast.Declaration>) => {
        switch (node.kind) {
            case 'FuncDeclaration': {
                const type = <TypeOperator>node.type;
                const args = node.varargs
                    ? this.typeToString(type.types[0])
                    : (type.types[0] as TypeTuple).types
                        .map(o => o.label ? `${o.label}: ${this.typeToString(o)}` : this.typeToString(o))
                        .join(', ');

                const returnType = this.typeToString(type.types[1]);

                return `func ${node.name.value}(${args}): ${returnType}`;
            }
            case 'ReturnStmt':
                return '';
            case 'CallExpr':
                return `${node.toString()}: ${this.typeToString(node.type)}`;
            case 'LetDeclaration':
                return `let ${node.name.value}: ${this.typeToString(node.type)}`;
            case 'CaseExpr':
                return `case (${this.typeToString((<Typed<Ast.Declaration>>node.expr).type)}) -> ${this.typeToString(node.type)}`;
            default:
                return `${node.toString()}: ${this.typeToString(node.type)}`;
        }
    }

    private tryWithErr = (fn: Function, getErr: () => TypeCheckError) => {
        try {
            return fn()
        } catch (e: any) {
            const err: any = getErr()
            err.__message = e?.message
            throw err
        }
    }

    private tryWithErrMsg = (fn: Function, getErr: () => string, token: Token) => {
        try {
            return fn()
        } catch (e: any) {
            e.__message = e.message
            e.message = getErr()
            e.token = token
            throw e
        }
    }

    private getInvalidCaseOptionError(
        mType: TyVar,
        exprT: TyVar,
        rType: TyVar,
        matcher: Ast.CaseMatcher,
    ): string {
        const range = lineInfo(matcher)
        const code = this.reader.getLineOfSource(range)
        let { start: { line, col } } = range
        return format(
            'Invalid matcher passed to case expression: Expected: "{1}" but got "{0}"\n'
            + '\n - expected case option type :: ({1} -> {4})'
            + '\n - received case option type :: ({0} -> {4})\n'
            + '\nLn {2}, Col {3}\n\t{5}\n\t{6}\n',
            this.typeToString(mType), this.typeToString(exprT), line, col,
            this.typeToString(rType), code, underline(range)
        );
    }

    private getInvalidCaseResultError(
        mType: TyVar,
        resType: TyVar,
        rType: TyVar,
        ifMatch: Ast.Expression,
    ): string {
        const range = lineInfo(ifMatch)
        const code = this.reader.getLineOfSource(range)
        let { start: { line, col } } = range
        return format(
            'Invalid result returned from case expression: Expected: "{1}" but got "{0}"\n'
            + '\n - expected case option type :: ({2} -> {1})'
            + '\n - received case option type :: ({2} -> {0})\n'
            + `\nLn ${line}, Col ${col}\n\t${code}\n\t${underline(range)}\n`,
            this.typeToString(resType), this.typeToString(rType), this.typeToString(mType),
        );
    }

    private getFunctionArgsUnificationError(
        pt1: TypeTuple,
        pt2: TypeTuple,
        term: Ast.Expression | Ast.Statement,
    ): TypeCheckError {
        const range = lineInfo(term);
        const code = this.reader.getLineOfSource(range)
        switch(term.kind) {
            case 'CallExpr': {
                const argstart = lineInfo(term.args[0])
                const argend = lineInfo(term.args[term.args.length - 1])
                let range: Range = { start: argstart.start, end: argend.end }
                let { start: { line, col } } = range
                return this.error(
                    format(
                          'Invalid number of arguments passed to function: "{0}" -- Expected: {1} but got {2}\n'
                        + '\n - expected arg types :: {5}'
                        + '\n - received arg types :: {6}\n'
                        + '\nLn {3}, Col {4}\n\t{7}\n\t{8}\n',
                        term.callee.toString(), pt2.types.length, pt1.types.length, line, col,
                        this.typeToString(pt2), this.typeToString(pt1), code, underline(range),
                    ), getToken(term), range)
            }
            default: {
                return this.error(`FunctionArgsUnificationError: t1::${this.typeToString(pt1)}, t2::${this.typeToString(pt2)}`, getToken(term));
            }
        }
    }

    private getReturnTypeUnificationError(
        type: TyVar,
        retType: TyVar,
        term: Ast.Expression | Ast.Statement,
    ): TypeCheckError {
        const range = lineInfo(term);
        const code = this.reader.getLineOfSource(range)
        switch(term.kind) {
            case 'ReturnStmt': {
                const range = lineInfo(term.value)
                const { start: { line, col } } = range
                return this.error(
                    format(
                          'Invalid return type from function: "{0}" -- Expected: "{1}" but got "{2}"\n'
                        + '\n - expected return type :: {5}'
                        + '\n - received return type :: {6}\n'
                        + '\nLn {3}, Col {4} -\n\n{7}\n{8}\n',
                        retType.label, this.typeToString(retType), this.typeToString(type), line, col,
                        this.typeToString(retType), this.typeToString(type), code, underline(range),
                    ), getToken(term), range)
            }
            default: {
                return this.error(`ReturnTypeUnificationError: t1::${this.typeToString(type)}, t2::${this.typeToString(retType)}`, getToken(term));
            }
        }
    }

    private getTypeOperatorsUnificationError(
        pt1: TypeOperator,
        pt2: TypeOperator,
        term: Ast.Expression | Ast.Statement,
    ): TypeCheckError{
        const { start } = lineInfo(term);
        switch(term.kind) {
            case 'CallExpr': {
                const msg = "Can't assign argument of type '{0}' to parameter '{4}' of type '{1}' in function '{5}'; Ln {2}, Col {3}";
                const args = [pt1.name, pt2.name, start.line, start.col, pt2.label ?? this.typeToString(pt2), term.callee.toString()];
                return this.error(format(msg, ...args), getToken(term.args[0]))
            }
            case 'BinaryExpr':
            case 'AssignExpr':
            default: {
                const msg = 'Type mismatch: {0} != {1}; Ln {2}, Col {3}';
                const args = [pt1.name, pt2.name, start.line, start.col];
                return this.error(format(msg, ...args), getToken(term))
            }
        }
    }

    private error(msg: string, token: Token, range?: Range) {
        return new TypeCheckError(msg, token, range)
    }

    private _next_variable_id = 0
    private _next_unique_name = 'a'

    private mkVariableName = (): string =>
        String.fromCharCode(this._next_unique_name.charCodeAt(0) + 1)

    private mkVariable = (): TypeVariable =>
        new TypeVariable(this._next_variable_id++)
}

export type BuiltinTypes = typeof GlobalTypes;

export const GlobalTypes: Record<string, TyVar> = (() => {
    const printArgs = FunctionArgs([strType()], true);
    Object.assign(printArgs.types[0], { label: 'text'})
    const importArgs = FunctionArgs([strType()], false);
    Object.assign(importArgs.types[0], { label: 'package'})
    return {
        print: FunctionType(printArgs, intType()),
        import: FunctionType(importArgs, intType()),
    }
})()
