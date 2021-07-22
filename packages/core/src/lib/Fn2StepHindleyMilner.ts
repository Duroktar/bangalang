import { Variant, impl, Narrow, matchExhaustive } from "@practical-fp/union-types"

// ----------------------------------------------------------------------------
// -- Utils
// ----------------------------------------------------------------------------

//#region Utils
let UNREACHABLE = (n: never, e?: any) => { if (e) throw e; return n; }

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
//#endregion

// ----------------------------------------------------------------------------
// -- Types
// ----------------------------------------------------------------------------

//#region Types
type Name = string

type Expr =
    | Variant<"Var", Name>
    | Variant<"App", [Expr, Expr]>
    | Variant<"Lam", [Name, Expr]>
    | Variant<"Let", [Name, Expr, Expr]>
    | Variant<"If",  [Expr, Expr, Expr]>
    | Variant<"Fix", Expr>
    | Variant<"Op",  [Binop, Expr, Expr]>
    | Lit

type Var = Narrow<Expr, "Var">

let { Var, App, Lam, Let, If, Fix, Op } = impl<Expr>()

type Lit =
    | Variant<"LInt", number>
    | Variant<"LBool", boolean>

let { LInt, LBool } = impl<Lit>()

enum Binop { Add, Sub, Mul, Eql }

type Type =
    | TVar
    | Variant<"TCon", Name>
    | Variant<"TArr", [Type, Type]>

type TVar = Variant<"TVar", Name>

let { TVar, TCon, TArr } = impl<Type>()

const typeInt: Type = TCon('Int')
const typeBool: Type = TCon('Bool')

type Scheme = Variant<"ForAll", [TVar[], Type]>

let { ForAll } = impl<Scheme>()
//#endregion

// ----------------------------------------------------------------------------
// -- Env
// ----------------------------------------------------------------------------

//#region Env
type TypeEnv = Variant<"TypeEnv", Map<Name, Scheme>>

let { TypeEnv } = impl<TypeEnv>()

type EnvEntry = [Name, Scheme]

let extend: (e: TypeEnv, t: [Name, Scheme | Type]) => TypeEnv
    = (env, t) => {
        let [name, scheme] = t
        scheme = ForAll.is(scheme) ? scheme : ForAll([[], scheme])
        return TypeEnv(new Map([...env.value.entries(), [name, scheme]]))
    }
//#endregion

// ----------------------------------------------------------------------------
// -- Classes
// ----------------------------------------------------------------------------

//#region Classes

class Infer<T> {
    constructor(
        public env: TypeEnv,
        public stateT?: T,
        public inferState: InferState = { count: 0 },
    ) {}

    get state() { return this.stateT! }
}

type InferState = { count: number }

let initInfer = (): InferState => ({ count: 0 })

type StateM = [Type, Constraint[]];

type Constraint = Variant<"Constraint", [Type, Type]>
let { Constraint } = impl<Constraint>()

type Unifier = [Subst, Constraint[]]

type Subst = Map<TVar, Type>

type SubstitutableA =
    | Type
    | Constraint
    | Scheme
    | TypeEnv

type Substitutable = SubstitutableA | SubstitutableA[];

let apply: <T extends Substitutable>(s: Subst, t: T) => T
    = (s, t: Substitutable) => {
        if (Array.isArray(t))
            return t.map(t1 => apply(s, t1))

        return matchExhaustive(t, {
            TCon: name => TCon(name),
            TVar: name => s.get(TVar(name)) ?? TVar(name),
            TArr: ([e1, e2]) => TArr([apply(s, e1), apply(s, e2)]),
            ForAll: ([as, t]) => {
                let s1 = as.reduce((acc, val) => {
                    acc.delete(val)
                    return acc
                }, new Map(s.entries()))
                return ForAll([as, apply(s1, t)])
            },
            Constraint: ([tp, cs]) => Constraint([apply(s, tp), apply(s, cs)]),
            TypeEnv: env => TypeEnv(mapMap(t1 => apply(s, t1), env))
        }) as any
    }

let ftv: (t: Substitutable) => Set<TVar>
    = t => {
        if (Array.isArray(t))
            return t.reduce((acc, val) => setUnion(acc, ftv(val)), new Set<TVar>())
        
        return matchExhaustive(t, {
            TypeEnv: env => ftv([...env.values()]),
            TCon: _ => new Set<TVar>(),
            TVar: name => new Set<TVar>([TVar(name)]),
            TArr: ([left, right]) => setUnion(ftv(left), ftv(right)),
            ForAll: ([as, ty]) => setDifference(ftv(ty), ftv(as)),
            Constraint: ([e1, e2]) => setUnion(ftv(e1), ftv(e2))
        })
    }

type TypeError =
    | Variant<"UnificationFail",     [Type, Type]>
    | Variant<"InfiniteType",        [TVar, Type]>
    | Variant<"UnBoundVariable",     string>
    | Variant<"Ambiguous",           [Constraint]>
    | Variant<"UnificationMismatch", [Type[], Type[]]>

let { InfiniteType, UnBoundVariable, UnificationFail, UnificationMismatch, Ambiguous } = impl<TypeError>()
//#endregion

// ----------------------------------------------------------------------------
// -- Inference
// ----------------------------------------------------------------------------

//#region Inference
let runInfer: (e: TypeEnv, i: Infer<StateM>) => StateM
    = (e, i) => {
        return i.state
    }

let inferExpr: (i: Infer<StateM>, e: TypeEnv, ex: Expr) => Scheme
    = (i, env, ex) => {
        let [ty, cs] = runInfer(env, infer(i, ex))
        let subst = runSolve(cs)
        return closeOver(apply(subst, ty))
    }

let constraintsExpr: (i: Infer<StateM>, e: TypeEnv, ex: Expr) => [Constraint[], Subst, Type, Scheme]
    = (i, env, ex) => {
        let [ty, cs] = runInfer(env, infer(i, ex))
        let subst = runSolve(cs)
        const sc = closeOver(apply(subst, ty));
        return [cs, subst, ty, sc]
    }

let closeOver: (t: Type) => Scheme
    = (t) => normalize(generalize(TypeEnv(new Map()), t))

let inEnv: <T>(o: EnvEntry, i: Infer<T>) => Infer<T>
    = (o, i) => new Infer(extend(i.env, o), i.state, i.inferState)

let lookupEnv: (env: TypeEnv, v: Var) => Type
    = (env, x) => {
        const rv = env.value.get(x.value)
        if (rv == null)
            throw UnBoundVariable(String(x))
        return instantiate(rv);
    }
    
let letters = (function() { let n = 1; let cb = () => `${String.fromCharCode((n++) + 97)}`; return { next: cb } })();

let fresh: () => TVar = () => TVar(letters.next())

let instantiate: (s: Scheme) => Type
    = ({ value: [as, t] }) => {
        let as1 = as.map(fresh)
        let s = new Map(zip(as, as1) as [TVar, Type][])
        return apply(s, t)
    }

let generalize: (env: TypeEnv, t: Type) => Scheme
    = (env, t) => {
        let as = [...setDifference(ftv(t), ftv(env))]
        return ForAll([as, t])
    }

let ops: Record<Binop, Type>
    = {
        [Binop.Add]: TArr([typeInt, TArr([typeInt, typeInt])]),
        [Binop.Mul]: TArr([typeInt, TArr([typeInt, typeInt])]),
        [Binop.Sub]: TArr([typeInt, TArr([typeInt, typeInt])]),
        [Binop.Eql]: TArr([typeInt, TArr([typeInt, typeBool])]),
    }

let infer: (i: Infer<StateM>, e: Expr) => Infer<StateM>
    = (i, ex) => {
        if (LInt.is(ex)) return ret(i, [typeInt, []])
        if (LBool.is(ex)) return ret(i, [typeBool, []])

        if (Var.is(ex))
            return ret(i, [lookupEnv(i.env, ex), []])

        if (Lam.is(ex)) {
            let [ name, expr ] = ex.value
            let tv = fresh()
            let x: EnvEntry = [name, ForAll([[], tv])]
            let [t, c] = inEnv(x, infer(i, expr)).state
            return ret(i, [TArr([tv, t]), c])
        }
    
        if (App.is(ex)) {
            let [ e1, e2 ] = ex.value
            let [t1, c1] = infer(i, e1).state
            let [t2, c2] = infer(i, e2).state
            let tv = fresh()
            let c3 = Constraint([t1, TArr([t2, tv])])
            return ret(i, [tv, c1.concat(c2, c3)])
        }
    
        if (Let.is(ex)) {
            let [ x, e1, e2 ] = ex.value
            let [t1, c1] = infer(i, e1).state
            let sub = runSolve(c1)
            let sc = generalize(apply(sub, env), apply(sub, t1))
            apply(sub, infer(i, e2).env)
            let [t2, c2] = inEnv([x, sc], i).state
            return ret(i, [t2, c1.concat(c2)])
        }
        
        if (Fix.is(ex)) {
            let e1 = ex.value
            let [t1, c1] = infer(i, e1).state
            let tv = fresh()
            let c2 = Constraint([TArr([tv, tv]), t1])
            return ret(i, [tv, c1.concat(c2)])
        }
    
        if (Op.is(ex)) {
            let [ op, e1, e2 ] = ex.value
            let [t1, c1] = infer(i, e1).state
            let [t2, c2] = infer(i, e2).state
            let tv = fresh()
            let u1 = TArr([t1, TArr([t2, tv])])
            let u2 = ops[op]
            let c3 = Constraint([u1, u2])
            return ret(i, [tv, c1.concat(c2, c3)])
        }
    
        if (If.is(ex)) {
            let [ cond, tr, fl ] = ex.value
            let [t1, c1] = infer(i, cond).state
            let [t2, c2] = infer(i, tr).state
            let [t3, c3] = infer(i, fl).state
            let c4 = Constraint([t1, typeBool])
            let c5 = Constraint([t2, t3])
            return ret(i, [t2, c1.concat(c2, c3, c4, c5)])
        }

        return UNREACHABLE(ex)
    }

let inferTop: (i: Infer<StateM>, e: TypeEnv, o: [string, Expr][]) => TypeEnv
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
//#endregion

// ----------------------------------------------------------------------------
// -- Constraint Solver
// ----------------------------------------------------------------------------

//#region Solver
let emptySubst: () => Subst = () => new Map()

let compose: (a: Subst, b: Subst) => Subst
    = (s1, s2) => mapUnion(mapMap(v => apply(s1, v), s2), s1)

let runSolve: (a: Constraint[]) => Subst
    = (cs) => {
        return solver([emptySubst(), cs])
    }

let unifyMany: (a: Type[], b: Type[]) => Subst
    = (a, b) => {
        if (a.length === 0 && b.length === 0)
            return emptySubst()
        if (a.length ===  b.length)
            throw UnificationMismatch([a, b])
        let [t1, ...ts1] = a
        let [t2, ...ts2] = b
        let su1 = unifies(t1, t2)
        let su2 = unifyMany(apply(su1, ts1), apply(su1, ts2))
        return compose(su2, su1)
    }

let unifies: (a: Type, b: Type) => Subst
    = (t1, t2) => {
        if (t1 === t2) return emptySubst()
        if (TVar.is(t1))
            return bind(t1, t2)
        if (TVar.is(t2))
            return bind(t2, t1)
        if (TArr.is(t1) && TArr.is(t2))
            return unifyMany(t1.value, t2.value)
        throw UnificationFail([t1, t2])
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
                    throw InfiniteType([a, t])
                new Map([[a, t]])
            }
        }
        return emptySubst()
    }

let occursCheck: (v: TVar, t: SubstitutableA) => boolean
    = (a, t) => setMember(a, ftv(t))
//#endregion

// ----------------------------------------------------------------------------
// -- Lost + Found
// ----------------------------------------------------------------------------

//#region Misc
let ret = (i: Infer<StateM>, v: StateM): Infer<StateM> => {
    return new Infer<StateM>(i.env, v, i.inferState)
}

function tryExpr(i: Infer<StateM>, expr: Expr, env: TypeEnv): Infer<StateM> {
    try {
        return infer(i, expr)
    } catch (err) {
        if (matchExhaustive(<TypeError>err, {
            Ambiguous: () => true,
            InfiniteType: () => true,
            UnificationFail: () => true,
            UnificationMismatch: () => true,
            UnBoundVariable: () => true,
        })) console.error(err)
        else throw err
    }
    return i
}
//#endregion

// ----------------------------------------------------------------------------
// -- Pretty Printer
// ----------------------------------------------------------------------------

//#region ppr

let ppr: (t: Type | Scheme | Expr) => string
    = t => {
        if (TCon.is(t))
            return t.value
        
        if (TVar.is(t))
            return t.value

        if (TArr.is(t))
            return `${ppr(t.value[0])} -> ${ppr(t.value[1])}`

        if (ForAll.is(t)) {
            if (t.value[0].length === 0)
                return ppr(t.value[1])
            return `forall ${t.value[0].map(ppr).join(' ')}. ${ppr(t.value[1])}`
        }
                
        if (App.is(t))
            return `(${ppr(t.value[0])} ${ppr(t.value[1])})`
                
        if (Var.is(t))
            return t.value
                
        if (LInt.is(t))
            return String(t.value)
                
        if (Lam.is(t))
            return String(t.value)
                
        if (Let.is(t))
            return String(t.value)
                
        if (If.is(t))
            return String(t.value)
                
        if (Fix.is(t))
            return String(t.value)

        if (Op.is(t))
            return String(t.value)

        if (LBool.is(t))
            return String(t.value)

        return UNREACHABLE(t, 'unreachable: ppr')
    }

let ppscheme: (a: Scheme) => string
    = (a) => ppr(a)

let ppsignature: (a: string, b: Scheme) => string
    = (a, b) => `${a} : ${ppscheme(b)}`
//#endregion

// ----------------------------------------------------------------------------
// -- Testing
// ----------------------------------------------------------------------------

//#region Testing
let builtins: [string, Type | Scheme][] = [
    ['true', typeBool],
    ['false', typeBool],
    ['zero', TArr([typeInt, typeBool])],
    ['pred', TArr([typeInt, typeInt])],
    ['times', TArr([typeInt, TArr([typeInt, typeInt])])],
];

let initenv = () => TypeEnv(new Map<Name, Scheme>());

let env = builtins.reduce(extend, initenv())

type Binding = [string, Expr]

let decl: (ex: Expr, n?: string) => Binding
    = (ex, name) => [name ?? 'it', ex]

let i = new Infer<StateM>(env)

let sig

let tyCtx = inferTop(i, env, [
    decl(LInt(5)),
])

sig = ppsignature('it', tyCtx.value.get('it')!)
sig
sig = ppsignature('5', ForAll([[], typeInt]))
sig
sig = ppsignature('true', ForAll([[], typeBool]))
sig
sig = ppsignature('zero', tyCtx.value.get('zero')!)
sig
sig = ppsignature('pred', tyCtx.value.get('pred')!)
sig
sig = ppsignature('times', tyCtx.value.get('times')!)
sig

tyCtx = inferTop(i, env, [
    decl(Var("true")),
])

sig = ppsignature('it', tyCtx.value.get('it')!)
sig
//#endregion
