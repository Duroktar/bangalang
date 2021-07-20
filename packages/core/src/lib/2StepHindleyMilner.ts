
class TypeCheckError {
    constructor(public message: string) {}
}

class UnificationFail {
    constructor(
        public type1: Type,
        public type2: Type,
    ) {}

    public message = "Unification Failure"
}

class InfiniteType {
    constructor(
        public type: Type,
        public occursIn: Type,
    ) {}

    public message = "Infinite Type"
}

function error(msg: string) {
    return new TypeCheckError(msg)
}

let zip = <A, B>(a:A[], b:B[]) => a.map((k, i) => [k, b[i]]);

let mapUnion: <K, V>(a: Map<K, V>, b: Map<K, V>) => Map<K, V>
    = (m1, m2) => new Map([...m1, ...m2.entries()])

let mapMap: <K, A>(f: (v: A) => A, map: Map<K, A>) => Map<K, A>
    = (fn, map, __rv = new Map()) => <any>map.forEach((v, k) => __rv.set(k, fn(v))) || __rv

let setUnion: <V>(a: Set<V>, b: Set<V>) => Set<V>
    = (s1, s2) => new Set([...s1, ...s2])

let setDifference: <T>(a: Set<T>, b: Set<T>) => Set<T>
    = <T>(a: Set<T>, b: Set<T>) => new Set([...a].filter(x => !b.has(x)));

type TorArrayT<T> = T | T[]

///////////////////////////////////////////////////////////////////////////////

type Name = string

type Expr =
    | Var
    | App
    | Lam
    | Let
    | Lit
    | If
    | Fix
    | Op

type Lit =
    | LInt
    | LBool

enum Binop { Add, Sub, Mul, Eql }

class Var {
    constructor(public name: Name) {}
    toString(): string {
        return this.name
    }
}

class App {
    constructor(
        public fn: Expr,
        public arg: Expr,
    ) {}
    toString(): string {
        return `(${this.fn} ${this.arg})`;
    }
}

class Lam {
    constructor(
        public name: Name,
        public expr: Expr,
    ) {}
    toString(): string {
        return `(fn ${this.name} => ${this.expr})`
    }
}

class Let {
    constructor(
        public v: Name,
        public defn: Expr,
        public body: Expr,
    ) {}
    toString(): string {
        return `(let ${this.v} = ${this.defn} in ${this.body})`
    }
}

class If {
    constructor(
        public cmp: Expr,
        public succ: Expr,
        public fail: Expr,
    ) {}
}

class Fix {
    constructor(
        public pnt: Expr,
    ) {}
}

class LInt {
    constructor(public value: number) {}
}

class LBool {
    constructor(public value: boolean) {}
}

class Op {
    constructor(
        public op: Binop,
        public left: Expr,
        public right: Expr,
    ) {}
}

type Type =
    | TVar
    | TCon
    | TArr

class TVar {
    get name() {
        if (this.__name === undefined) {
            this.__name = TVar.NextVariableId
            TVar.NextVariableId = String
                .fromCharCode(this.__name.charCodeAt(0) + 1)
        }
        return this.__name
    }

    static NextVariableId = 'a'
    
    private __name?: string
}

class TCon {
    constructor(
        public readonly name: string,
    ) {}
}

class TArr {
    constructor(
        public left: Type,
        public right: Type,
    ) {}
}

const typeInt: Type = new TCon('Int')
const typeBool: Type = new TCon('Bool')

type Scheme = ForAll

class ForAll {
    constructor(
        public as: TVar[],
        public t: Type,
    ) {}
}

type TypeEnv = Map<Var['name'], Scheme>

let extend: (e: TypeEnv, t: [Var['name'], Scheme]) => TypeEnv
    = (env, [name, scheme]) => {
        return new Map([...env.entries(), [name, scheme]])
    }

type Subst = Map<TVar, Type>

const nullSubst: Subst = new Map()

let compose: (a: Subst, b: Subst) => Subst
    = (s1, s2) => mapUnion(mapMap(v => apply(s1, v), s2), s1)

type Substitutable = TorArrayT<
    | Type
    | Scheme
    | TypeEnv
>;

let apply: <T extends Substitutable>(s: Subst, t: T) => T
    = (s, t) => {
        if (Array.isArray(t))
            return t.map(t1 => apply(s, t1))

        if (t instanceof TCon)
            return new TCon(t.name)
        if (t instanceof TVar)
            return s.get(t) ?? <any>t
        if (t instanceof TArr)
            return new TArr(apply(s, t.left), apply(s, t.right))

        if (t instanceof ForAll) {
            let s1 = t.as.reduce((acc, val) => {
                acc.delete(val)
                return acc
            }, new Map(s.entries()))
            return new ForAll(t.as, apply(s1, t.t))
        }

        if (t instanceof Map)
            return mapMap(t1 => apply(s, t1), env)

        throw error('unreachable: apply -> ' + (<any>t).constructor.name)
    }

let ftv: (t: Substitutable) => Set<TVar>
    = (t: Substitutable): Set<TVar> => {
        if (Array.isArray(t))
            return t.reduce((acc, val) => setUnion(acc, ftv(val)), new Set<TVar>())
        if (t instanceof Map)
            return ftv([...t.values()])
        if (t instanceof TCon)
            return new Set<TVar>()
        if (t instanceof TVar)
            return new Set<TVar>([t])
        if (t instanceof TArr)
            return setUnion(ftv(t.left), ftv(t.right))
        if (t instanceof ForAll)
            return setDifference(ftv(t), ftv(t.as))

        throw new Error('unreachable ftv: ' + JSON.stringify(t))
    }
    
let letters = (function() { let n = 1; let cb = () => `${String.fromCharCode((n++) + 97)}`; return { next: cb } })();

let fresh: () => TVar
    = () => new TVar()

let occursCheck: (v: TVar, t: Type) => boolean
    = (a, t) => ftv(t).has(a)

let unify: (t1: Type, t2: Type) => Subst
    = (t1, t2) => {
        if (t1 instanceof TVar)
            return bind(t1, t2)
        if (t2 instanceof TVar)
            return unify(t2, t1)
        if (t1 instanceof TCon && t2 instanceof TCon && t1 === t2)
            return nullSubst
        if (t1 instanceof TArr && t2 instanceof TArr) {
            let s1 = unify(t1.left, t2.left)
            let s2 = unify(apply(s1, t1.right), apply(s1, t2.right))
            return compose(s1, s2)
        }

        throw new UnificationFail(t1, t2)
    }

let bind: (v: TVar, t: Type) => Subst
    = (a, t) => {
        if (a instanceof TVar) {
            if (a !== t) {
                if (occursCheck(a, t))
                    throw new InfiniteType(a, t)
                new Map([[a, t]])
            }
        }
        return nullSubst
    }

let instantiate: (s: Scheme) => Type
    = ({ as, t }) => {
        let as1 = as.map(fresh)
        let s = new Map(zip(as, as1) as [TVar, Type][])
        return apply(s, t)
    }

let generalize: (env: TypeEnv, t: Type) => Scheme
    = (env, t) => {
        let as = setDifference(ftv(t), ftv(env))
        return new ForAll([...as], t)
    }

let infer: (env: TypeEnv, e: Expr) => [Subst, Type]
    = (env, ex) => {
        if (ex instanceof Var) return lookupEnv(env, ex)

        if (ex instanceof Lam) {
            let tv = fresh()
            let sX = [new Var(ex.name), new ForAll([], tv)]
            let env1 = extend(env, <[string, Scheme]>sX)
            let [s1, t1] = infer(env1, ex.expr)
            return [s1, apply(s1, new TArr(tv, t1))]
        }
    
        if (ex instanceof App) {
            let { fn: e1, arg: e2 } = ex
            let tv = fresh()
            let [s1, t1] = infer(env, e1)
            let [s2, t2] = infer(apply(s1, env), e2)
            let s3 = unify(apply(s2, t1), new TArr(t2, tv))
            return [compose(compose(s3, s2), s1), apply(s3, tv)]
        }
    
        if (ex instanceof Let) {
            let { v: x, defn: e1, body: e2 } = ex
            let [s1, t1] = infer(env, e1)
            let env1 = apply(s1, env)
            let tI = generalize(env1, t1)
            let [s2, t2] = infer(extend(env1, [x, tI]), e2)
            return [compose(s1, s2), t2]
        }
    
        if (ex instanceof If) {
            let { cmp: cond, succ: tr, fail: fl } = ex
            let [s1, t1] = infer(env, cond)
            let [s2, t2] = infer(env, tr)
            let [s3, t3] = infer(env, fl)
            let s4 = unify(t1, typeBool)
            let s5 = unify(t2, t3)
            return [compose(compose(compose(compose(s5, s4), s3), s2), s1), apply(s5, t2)]
        }
    
        if (ex instanceof Fix) {
            let { pnt: e1 } = ex
            let [s1, t] = infer(env, e1)
            let tv = fresh()
            let s2 = unify(new TArr(tv, tv), t)
            return [s2, apply(s1, tv)]
        }
    
        if (ex instanceof Op) {
            let { op, left: e1, right: e2 } = ex
            let [s1, t1] = infer(env, e1)
            let [s2, t2] = infer(env, e2)
            let tv = fresh()
            let s3 = unify(new TArr(t1, new TArr(t2, tv)), ops[op])
            return [compose(compose(s3, s2), s1), apply(s3, tv)]
        }
    
        if (ex instanceof LInt) return [nullSubst, typeInt]
        if (ex instanceof LBool) return [nullSubst, typeBool]

        throw error('unreachable infer: ' + JSON.stringify(ex))
    }

let lookupEnv: (env: TypeEnv, v: Var) => [Subst, Type]
    = (env, x) => {
        const rv = env.get(x.name)
        if (rv == null)
            throw error(`unbound variable: '${x}'`)
        return [nullSubst, instantiate(rv)]
    }

let ops: Record<Binop, Type>
    = {
        [Binop.Add]: new TArr(typeInt, new TArr(typeInt, typeInt)),
        [Binop.Mul]: new TArr(typeInt, new TArr(typeInt, typeInt)),
        [Binop.Sub]: new TArr(typeInt, new TArr(typeInt, typeInt)),
        [Binop.Eql]: new TArr(typeInt, new TArr(typeInt, typeBool)),
    }

let ppr: (t: Type | Scheme | Expr) => string
    = t => {
        if (t instanceof TCon)
            return t.name
        
        if (t instanceof TVar)
            return t.name

        if (t instanceof TArr)
            return `${ppr(t.left)} -> ${ppr(t.right)}`

        if (t instanceof ForAll) {
            if (t.as.length === 0)
                return ppr(t.t)
            return `forall ${t.as.map(ppr).join(' ')}. ${ppr(t.t)}`
        }
                
        if (t instanceof App)
            return `(${ppr(t.fn)} ${ppr(t.arg)})`
                
        if (t instanceof Var)
            return t.name
                
        if (t instanceof LInt)
            return String(t.value)

        throw error('unreachable: ppr')
    }

///////////////////////////////////////////////////////////////////////////////

export function tryExpr(expr: Expr, env: TypeEnv): [Subst, Type] {
    try {
        return infer(env, expr)
    } catch (err) {
        if (err instanceof TypeCheckError) {
            err
            console.error(err)
        } else
        if (err instanceof InfiniteType) {
            err
            console.error(err)
        } else
        if (err instanceof UnificationFail) {
            err
            console.error(err)
        }
        throw err
    }
}

///////////////////////////////////////////////////////////////////////////////

const var1 = fresh();
const var2 = fresh();
const pairType = new TArr(var1, var2)

const var3 = fresh();

let env: TypeEnv = new Map([
    ['pair', generalize(new Map(), new TArr(var1, new TArr(var2, pairType)))],
    ['true', generalize(new Map(), typeBool)],
    ['cond', generalize(new Map(), new TArr(typeBool, new TArr(var3, new TArr(var3, var3))))],
    ['zero', generalize(new Map(), new TArr(typeInt, typeBool))],
    ['pred', generalize(new Map(), new TArr(typeInt, typeInt))],
    ['times', generalize(new Map(), new TArr(typeInt, new TArr(typeInt, typeInt)))],
])

const ast = [
    new App(new App(new Var("pair"), new LInt(5)), new Var("true")),
]

// const tvarA = fresh();
// const tvarB = fresh();

// const forAllTest = new ForAll([tvarA], new TArr(tvarA, new TArr(tvarA, tvarA)));
// const forAllTest2 = new ForAll([tvarA, tvarB], new TArr(tvarA, new TArr(tvarB, tvarA)));

// console.log(ppr(forAllTest))
// console.log(ppr(forAllTest2))

for (let example of ast) {
    const rv = tryExpr(example, env);
    if (rv == null) {
        rv
        continue
    }

    let [s, type] = rv
    // let txt = `${ppr(example)} :: ${ppr(type)}`
    // console.log(ppr(example))
    // console.log(ppr(type))
    // console.log(txt)
}

console.log(ppr(env.get('pair')!))
// console.log(ppr(env.get('true')!))

///////////////////////////////////////////////////////////////////////////////

type Constraint = {
    type: Type
    subs: Type
}

type Unifier = {
    subs: Subst
    cons: Constraint[]
}

///////////////////////////////////////////////////////////////////////////////
