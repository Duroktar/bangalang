
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

class UnificationMismatch {
    constructor(
        public type1: Type[],
        public type2: Type[],
    ) {}

    public message = "Unification Mismatch"
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
    = (s1, s2) => new Set([...s1].filter(x => !s2.has(x)));

let setMember: <T>(a: T, b: Set<T>) => boolean
    = (s1, s2) => s2.has(s1)

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

type Substitutable = TorArrayT<
    | Type
    | Constraint
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

        if (t instanceof Constraint)
            return new Constraint([apply(s, t.value[0]), apply(s, t.value[1])])

        if (t instanceof Map)
            return mapMap(t1 => apply(s, t1), env)

        throw error('unreachable: apply -> ' + (<any>t).constructor.name)
    }

let ftv: (t: Substitutable) => Set<TVar>
    = (t): Set<TVar> => {
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
        if (t instanceof Constraint)
            return setUnion(ftv(t.value[0]), ftv(t.value[1]))

        throw new Error('unreachable ftv: ' + JSON.stringify(t))
    }

let inEnv: <T>(o: [Name, Scheme], i: Infer<T>) => Infer<T>
    = (o, i) => {
        let env1 = extend(i.env, [...o])
        let i1 = new Infer(env1, i.state, i.inferState)
        return i1
    }

let lookupEnv: (env: TypeEnv, v: Var) => Type
    = (env, x) => {
        const rv = env.get(x.name)
        if (rv == null)
            throw error(`unbound variable: '${x}'`)
        return instantiate(rv);
    }
    
let letters = (function() { let n = 1; let cb = () => `${String.fromCharCode((n++) + 97)}`; return { next: cb } })();

let fresh: () => TVar
    = () => new TVar()

let instantiate: (s: Scheme) => Type
    = ({ as, t }) => {
        let as1 = as.map(fresh)
        let s = new Map(zip(as, as1) as [TVar, Type][])
        return apply(s, t)
    }

let generalize: (env: TypeEnv, t: Type) => Scheme
    = (env, t) => {
        let as = [...setDifference(ftv(t), ftv(env))]
        return new ForAll(as, t)
    }

let ops: Record<Binop, Type>
    = {
        [Binop.Add]: new TArr(typeInt, new TArr(typeInt, typeInt)),
        [Binop.Mul]: new TArr(typeInt, new TArr(typeInt, typeInt)),
        [Binop.Sub]: new TArr(typeInt, new TArr(typeInt, typeInt)),
        [Binop.Eql]: new TArr(typeInt, new TArr(typeInt, typeBool)),
    }

type InferState = {
    count: number;
};

class Infer<T> {
    constructor(
        public env: TypeEnv,
        public stateT?: T,
        public inferState: InferState = { count: 0 },
    ) {}

    get state() { return this.stateT! }
}

type StateT = [Type, Constraint[]];

let ret = (i: Infer<StateT>, v: StateT): Infer<StateT> => {
    return new Infer<StateT>(i.env, v, i.inferState)
}

let infer: (i: Infer<StateT>, e: Expr) => Infer<StateT>
    = (i, ex) => {
        if (ex instanceof LInt) return ret(i, [typeInt, []])
        if (ex instanceof LBool) return ret(i, [typeBool, []])

        if (ex instanceof Var)
            return ret(i, [lookupEnv(i.env, ex), []])

        if (ex instanceof Lam) {
            let tv = fresh()
            let x: [Name, Scheme] = [ex.name, new ForAll([], tv)]
            let [t, c] = inEnv(x, infer(i, ex.expr)).state
            return ret(i, [new TArr(tv, t), c])
        }
    
        if (ex instanceof App) {
            let { fn: e1, arg: e2 } = ex
            let [t1, c1] = infer(i, e1).state
            let [t2, c2] = infer(i, e2).state
            let tv = fresh()
            let c3 = new Constraint([t1, new TArr(t2, tv)])
            return ret(i, [tv, c1.concat(c2, c3)])
        }
    
        if (ex instanceof Let) {
            let { v: x, defn: e1, body: e2 } = ex
            let [t1, c1] = infer(i, e1).state
            let sub = runSolve(c1)
            let sc = generalize(apply(sub, env), apply(sub, t1))
            apply(sub, infer(i, e2).env)
            let [t2, c2] = inEnv([x, sc], i).state
            return ret(i, [t2, c1.concat(c2)])
        }
        
        if (ex instanceof Fix) {
            let { pnt: e1 } = ex
            let [t1, c1] = infer(i, e1).state
            let tv = fresh()
            let c2 = new Constraint([new TArr(tv, tv), t1])
            return ret(i, [tv, c1.concat(c2)])
        }
    
        if (ex instanceof Op) {
            let { op, left: e1, right: e2 } = ex
            let [t1, c1] = infer(i, e1).state
            let [t2, c2] = infer(i, e2).state
            let tv = fresh()
            let u1 = new TArr(t1, new TArr(t2, tv))
            let u2 = ops[op]
            let c3 = new Constraint([u1, u2])
            return ret(i, [tv, c1.concat(c2, c3)])
        }
    
        if (ex instanceof If) {
            let { cmp: cond, succ: tr, fail: fl } = ex
            let [t1, c1] = infer(i, cond).state
            let [t2, c2] = infer(i, tr).state
            let [t3, c3] = infer(i, fl).state
            let c4 = new Constraint([t1, typeBool])
            let c5 = new Constraint([t2, t3])
            return ret(i, [t2, c1.concat(c2, c3, c4, c5)])
        }

        throw error('unreachable infer: ' + JSON.stringify(ex))
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

let runInfer: (e: TypeEnv, i: Infer<StateT>) => StateT
    = (e, i) => {
        return i.state
    }

let inferExpr: (i: Infer<StateT>, e: TypeEnv, ex: Expr) => Scheme
    = (i, env, ex) => {
        let [ty, cs] = runInfer(env, infer(i, ex))
        let subst = runSolve(cs)
        return closeOver(apply(subst, ty))
    }

let constraintsExpr: (i: Infer<StateT>, e: TypeEnv, ex: Expr) => [Constraint[], Subst, Type, Scheme]
    = (i, env, ex) => {
        let [ty, cs] = runInfer(env, infer(i, ex))
        let subst = runSolve(cs)
        const sc = closeOver(apply(subst, ty));
        return [cs, subst, ty, sc]
    }

let closeOver: (t: Type) => Scheme
    = (t) => normalize(generalize(new Map(), t))

let inferTop: (i: Infer<StateT>, e: TypeEnv, o: [string, Expr][]) => TypeEnv
    = (i, env, exprs) => {
        if (exprs.length === 0)
            return env
        let [head, ...xs] = exprs
        let [name, ex] = head
        
        let ty = inferExpr(i, env, ex)
        return inferTop(i, extend(env, [name, ty]), xs)
    }

let normalize: (s: Scheme) => Scheme
    = (s) => {
        return s
    }

// -------------------------------------------------------------------------------
// -- Constraint Solver
// -------------------------------------------------------------------------------

class Constraint {
    constructor (public value: [Type, Type]) {}
}

type Unifier = [Subst, Constraint[]]
   
let emptySubst: () => Subst = () => new Map()

let compose: (a: Subst, b: Subst) => Subst
    = (s1, s2) => mapUnion(mapMap(v => apply(s1, v), s2), s1)

let runSolve: (a: Constraint[]) => Subst
    = (cs) => {
        return solver([emptySubst(), cs])
    }

let unifyMany: (a: Type[], b: Type[]) => Subst
    =  (a, b) => {
        if (a.length === 0 && b.length === 0)
            return emptySubst()
        if (a.length ===  b.length)
            throw new UnificationMismatch(a, b)
        let [t1, ...ts1] = a
        let [t2, ...ts2] = b
        let su1 = unifies(t1, t2)
        let su2 = unifyMany(apply(su1, ts1), apply(su1, ts2))
        return compose(su2, su1)
    }

let unifies: (a: Type, b: Type) => Subst
    = (t1, t2) => {
        if (t1 === t2) return emptySubst()
        if (t1 instanceof TVar)
            return bind(t1, t2)
        if (t2 instanceof TVar)
            return bind(t2, t1)
        if (t1 instanceof TArr && t2 instanceof TArr)
            return unifyMany([t1.left, t1.right], [t2.left, t2.right])
        throw new UnificationFail(t1, t2)
    }

let solver: (u: Unifier) => Subst
    = ([su, cs]) => {
        if (cs.length === 0) return su
        let [head, ...cs0] = cs
        let [t1, t2] = head.value
        let su1 = unifies(t1, t2)
        return solver([compose(su1, su), apply(su1, cs0)])
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
        return emptySubst()
    }

let occursCheck: (v: TVar, t: Substitutable) => boolean
    = (a, t) => setMember(a, ftv(t))

///////////////////////////////////////////////////////////////////////////////

export function tryExpr(i: Infer<StateT>, expr: Expr, env: TypeEnv): Infer<StateT> {
    try {
        return infer(i, expr)
    } catch (err) {

        if (   err instanceof TypeCheckError
            || err instanceof InfiniteType
            || err instanceof UnificationFail
        ) {
            console.error(err)
        }
        throw err
    }
}

///////////////////////////////////////////////////////////////////////////////

let ppscheme: (a: Scheme) => string
    = (a) => ppr(a)

let ppsignature: (a: string, b: Scheme) => string
    = (a, b) => `${a} : ${ppscheme(b)}`

///////////////////////////////////////////////////////////////////////////////

// const var1 = fresh();
// const var2 = fresh();
// const pairType = new TArr(var1, var2)

// const var3 = fresh();

let env: TypeEnv = new Map([
    // ['pair', generalize(new Map(), new TArr(var1, new TArr(var2, pairType)))],
    ['true', generalize(new Map(), typeBool)],
    ['false', generalize(new Map(), typeBool)],
    // ['cond', generalize(new Map(), new TArr(typeBool, new TArr(var3, new TArr(var3, var3))))],
    // ['zero', generalize(new Map(), new TArr(typeInt, typeBool))],
    // ['pred', generalize(new Map(), new TArr(typeInt, typeInt))],
    // ['times', generalize(new Map(), new TArr(typeInt, new TArr(typeInt, typeInt)))],
])

const ast: [string, Expr][] = [
    // new App(new App(new Var("pair"), new LInt(5)), new Var("true")),
    ['5', new LInt(5)],
    ['true', new Var("true")],
]

// const tvarA = fresh();
// const tvarB = fresh();

// const forAllTest = new ForAll([tvarA], new TArr(tvarA, new TArr(tvarA, tvarA)));
// const forAllTest2 = new ForAll([tvarA, tvarB], new TArr(tvarA, new TArr(tvarB, tvarA)));

// console.log(ppr(forAllTest))
// console.log(ppr(forAllTest2))

let i = new Infer<StateT>(env)
let tyCtx = inferTop(i, env, ast)

let sig = ppsignature('5', tyCtx.get('5')!)
sig
sig = ppsignature('true', tyCtx.get('true')!)
sig

// for (let example of ast) {
//     const rv = tryExpr(i, example, env);
//     if (rv == null) {
//         rv
//         continue
//     }

//     console.log(rv.inferState)
//     console.log(rv.env)
//     console.log(rv.state)

//     let [s, constraints] = rv.state

//     s
//     constraints
//     let solved = runSolve(constraints)
//     console.log(solved)
// }

// inferTop
// constraintsExpr
// console.log(ppr(env.get('pair')!))
// console.log(ppr(env.get('true')!))

///////////////////////////////////////////////////////////////////////////////
