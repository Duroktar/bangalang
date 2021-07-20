
class TypeCheckError {
    constructor(public message: string) {}
}

function error(msg: string) {
    return new TypeCheckError(msg)
}

const zip = <A, B>(a:A[], b:B[]) => a.map((k, i) => [k, b[i]]);

export type Node =
    | Lambda
    | Identifier
    | Apply
    | Let
    | LetRec

export class Lambda {
    constructor(
        public v: string,
        public body: Node,
    ) {}
    toString(): string {
        return `(fn ${this.v} => ${this.body})`
    }
}

export class Identifier {
    constructor(public name: string) {}
    toString(): string {
        return this.name
    }
}

export class Apply {
    constructor(
        public fn: Node,
        public arg: Node,
    ) {}
    toString(): string {
        return `(${this.fn} ${this.arg})`;
    }
}

export class Let {
    constructor(
        public v: string,
        public defn: Node,
        public body: Node,
    ) {}
    toString(): string {
        return `(let ${this.v} = ${this.defn} in ${this.body})`
    }
}

export class LetRec {
    constructor(
        public v: string,
        public defn: Node,
        public body: Node,
    ) {}
    toString(): string {
        return `(let ${this.v} = ${this.defn} in ${this.body})`
    }
}

type TyVar =
    | TypeVariable
    | TypeOperator

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
            return `${this.types[0].toString()} ${this.name} ${this.types[1].toString()}`
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

const intType = new TypeOperator('int')
const strType = new TypeOperator('str')
const boolType = new TypeOperator('bool')
const nilType = new TypeOperator('()')


export class TypeEnv {
    constructor(
        public map: Record<string, TyVar> = { },
    ) { }
    get(name: string, nonGeneric: Set<TyVar>) {
        if (name in this.map)
            return fresh(this.map[name], nonGeneric)
        throw 'undefined symbol: ' + name
    }
    extend(name: string, val: TyVar) {
        Object.assign(this.map, { [name]: val })
    }
    copy() {
        return new TypeEnv(Object.assign({}, this.map))
    }
}


let analyze: (a: Node, b: TypeEnv, c?: Set<TyVar>) => TyVar
    = (node, env, nonGeneric = new Set()) => {
    if (node instanceof Identifier) {
        return env.get(node.name, nonGeneric)
    }
    if (node instanceof Apply) {
        const funcType = analyze(node.fn, env, nonGeneric);
        const argType = analyze(node.arg, env, nonGeneric);
        const retType = new TypeVariable();
        unify(new Function(argType, retType), funcType);
        return retType;
    }
    if (node instanceof Lambda) {
        const argType = new TypeVariable();
        const newEnv = env.copy()
        newEnv.extend(node.v, argType)
        const newNonGeneric = new Set(nonGeneric.keys())
        newNonGeneric.add(argType)
        const resultType = analyze(node.body, newEnv, newNonGeneric)
        return new Function(argType, resultType)
    }
    if (node instanceof Let) {
        const defnType = analyze(node.defn, env, nonGeneric)
        const newEnv = env.copy()
        newEnv.extend(node.v, defnType)
        return analyze(node.body, newEnv, nonGeneric)
    }
    if (node instanceof LetRec) {
        const newType = new TypeVariable();
        const newEnv = env.copy()
        newEnv.extend(node.v, newType)
        const newNonGeneric = new Set(nonGeneric.keys())
        newNonGeneric.add(newType)
        const defnType = analyze(node.defn, env, nonGeneric)
        unify(newType, defnType)
        return analyze(node.body, newEnv, nonGeneric)
    }

    throw new Error('unreachable: analyze -> ' + node)
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

        throw new Error(`Unreachable in 'fresh'`)
    }

    return freshRec(type)
}

function unify(t1: TyVar, t2: TyVar): void {
    const a = prune(t1)
    const b = prune(t2)
    if (a instanceof TypeVariable) {
        if (a !== b) {
            if (occursInType(a, b))
                throw error('recursive unification')
            a.instance = <TypeVariable>b
        }
    }
    else if (a instanceof TypeOperator && b instanceof TypeVariable)
        unify(b, a)
    else if (a instanceof TypeOperator && b instanceof TypeOperator) {
        if (a.name !== b.name || a.types.length !== b.types.length)
            throw error('cannot unify')
        zip(a.types, b.types).forEach(([t1, t2]) => unify(t1, t2))
    } else {
        throw error('Not unified')
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

export function tryExpr(term: Node, env: TypeEnv) {
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

const typeInt: TyVar = new TypeOperator('Int')
const typeBool: TyVar = new TypeOperator('Bool')

const var1 = new TypeVariable();
const var2 = new TypeVariable();
const pairType = new TypeOperator('.', [var1, var2])

const var3 = new TypeVariable();

const env = new TypeEnv({
    pair: new Function(var1, new Function(var2, pairType)),
    true: typeBool,
    cond: new Function(typeBool, new Function(var3, new Function(var3, var3))),
    zero: new Function(typeInt, typeBool),
    pred: new Function(typeInt, typeInt),
    times: new Function(typeInt, new Function(typeInt, typeInt)),
})

const ast = [
    new LetRec("factorial",
        new Lambda("n",
            new Apply(
                new Apply(
                    new Apply(new Identifier("cond"),
                            new Apply(new Identifier("zero"), new Identifier("n"))),
                    new Identifier("1")),
                new Apply(
                    new Apply(new Identifier("times"), new Identifier("n")),
                    new Apply(new Identifier("factorial"),
                        new Apply(new Identifier("pred"), new Identifier("n")))
                )
            )
        ),
        new Apply(new Identifier("factorial"), new Identifier("5"))),
    new Apply(new Apply(new Identifier("pair"), new Identifier("5")), new Identifier("true"))
]

for (let example of ast) {
    const rv = tryExpr(example, env);
    rv
    console.log(`${rv}`)
    console.log(`${ast[0]}`)
    console.log(`${env.get('pair', new Set())}`)
}
