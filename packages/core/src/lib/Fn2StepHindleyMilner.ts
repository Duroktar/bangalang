import { Variant, impl, Narrow, matchExhaustive } from "@practical-fp/union-types"
import { Map, Set } from 'immutable'

let match = matchExhaustive
type InferArgs<T> =
  T extends [string, ...infer Args] ? Args
  : never

// ----------------------------------------------------------------------------
// -- Utils
// ----------------------------------------------------------------------------

//#region Utils
let UNREACHABLE = (n: never, e?: any) => { if (e) throw e; return n; }

let zip = <A, B>(a:A[], b:B[]): [A, B][] => a.map((k, i) => [k, b[i]]);
let zipp = <A, B>(a:A[], b:{next:()=>B}): [A, B][] => a.map((k, i) => [k, b.next()]);

let mapUnion: <K, V>(a: Map<K, V>, b: Map<K, V>) => Map<K, V>
    = (m1, m2) => Map([...m1.entries(), ...m2.entries()])

let mapMap: <K, A>(f: (v: A) => A, map: Map<K, A>) => Map<K, A>
    = (fn, map) => map.mapEntries(([k, v]) => [k, fn(v)])

let setUnion: <V>(a: Set<V>, b: Set<V>) => Set<V>
    = (s1, s2) => Set([...s1, ...s2])

let setDifference: <T>(a: Set<T>, b: Set<T>) => Set<T>
    = (s1, s2) => s1.filter(x => !s2.has(x))

let setMember: <T>(a: T, b: Set<T>) => boolean
    = (s1, s2) => s2.has(s1)
//#endregion

// ----------------------------------------------------------------------------
// -- Types
// ----------------------------------------------------------------------------

//#region Types

// terms

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

// types

type Type =
    | TVar
    | TCon
    | TArr

type TVar = Variant<"TVar", Name>
type TCon = Variant<"TCon", Name>
type TArr = Variant<"TArr", [Type, Type]>

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
        return TypeEnv(env.value.set(name, scheme))
    }
//#endregion

// ----------------------------------------------------------------------------
// -- Classes
// ----------------------------------------------------------------------------

//#region Classes

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
                }, Map(s.entries()))
                return ForAll([as, apply(s1, t)])
            },
            Constraint: ([tp, cs]) => Constraint([apply(s, tp), apply(s, cs)]),
            TypeEnv: env => TypeEnv(mapMap(t1 => apply(s, t1), env))
        }) as any
    }

let ftv: (t: Substitutable) => Set<TVar>
    = t => {
        if (Array.isArray(t))
            return t.reduce((acc, val) => setUnion(acc, ftv(val)), Set<TVar>())

        return matchExhaustive(t, {
            TypeEnv: env => ftv([...env.values()]),
            TCon: _ => Set<TVar>(),
            TVar: name => Set<TVar>([TVar(name)]),
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
let emptyEnv: () => Map<Name, Scheme>
    = () => Map<Name, Scheme>()

let inferExpr: (e: TypeEnv, ex: Expr) => Scheme
    = (env, ex) => {
        let [ty, cs] = infer(ex, env)
        let subst = runSolve(cs)
        return closeOver(apply(subst, ty))
    }

let constraintsExpr: (e: TypeEnv, ex: Expr) => [Constraint[], Subst, Type, Scheme]
    = (env, ex) => {
        let [ty, cs] = infer(ex, env)
        let subst = runSolve(cs)
        let sc = closeOver(apply(subst, ty));
        return [cs, subst, ty, sc]
    }

let closeOver: (t: Type) => Scheme
    = (t) => normalize(generalize(TypeEnv(emptyEnv()), t))

let inEnv: (o: EnvEntry, env: TypeEnv) => TypeEnv
    = (o, env) => extend(env, o)

let lookupEnv: (env: TypeEnv, v: Var) => Type
    = (env, x) => {
        let rv = env.value.get(x.value)
        if (rv == null)
            throw UnBoundVariable(x.value)
        return instantiate(rv);
    }

let letters = (function() { let n = 1; let cb = () => `${String.fromCharCode((n++) + 97)}`; return { next: cb } })();

let fresh: () => TVar = () => TVar(letters.next())

let instantiate: (s: Scheme) => Type
    = ({ value: [as, t] }) => {
        let as1 = as.map(fresh)
        let s = Map(zip(as, as1) as [TVar, Type][])
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

let infer: (e: Expr, env: TypeEnv) => StateM
    = (ex, env) => {
        if (LInt.is(ex)) return [typeInt, []]
        if (LBool.is(ex)) return [typeBool, []]

        if (Var.is(ex)) {
            let fromEnv = lookupEnv(env, ex)
            return [fromEnv, []]
        }

        if (Lam.is(ex)) {
            let [ name, expr ] = ex.value
            let tv = fresh()
            let x: EnvEntry = [name, ForAll([[], tv])]
            let [t, c] = infer(expr, inEnv(x, env))
            return [TArr([tv, t]), c]
        }

        if (App.is(ex)) {
            let [ e1, e2 ] = ex.value
            let [t1, c1] = infer(e1, env)
            let [t2, c2] = infer(e2, env)
            let tv = fresh()
            let c3 = Constraint([t1, TArr([t2, tv])])
            return [tv, c1.concat(c2, c3)]
        }

        if (Let.is(ex)) {
            let [ x, e1, e2 ] = ex.value
            let [t1, c1] = infer(e1, env)
            let sub = runSolve(c1)
            let sc = generalize(apply(sub, env), apply(sub, t1))
            let env1 = apply(sub, inEnv([x, sc], env))
            let [t2, c2] = infer(e2, env1)
            return [t2, c1.concat(c2)]
        }

        if (Fix.is(ex)) {
            let e1 = ex.value
            let [t1, c1] = infer(e1, env)
            let tv = fresh()
            let c2 = Constraint([TArr([tv, tv]), t1])
            return [tv, c1.concat(c2)]
        }

        if (Op.is(ex)) {
            let [ op, e1, e2 ] = ex.value
            let [t1, c1] = infer(e1, env)
            let [t2, c2] = infer(e2, env)
            let tv = fresh()
            let u1 = TArr([t1, TArr([t2, tv])])
            let c3 = Constraint([u1, ops[op]])
            return [tv, c1.concat(c2, c3)]
        }

        if (If.is(ex)) {
            let [ cond, tr, fl ] = ex.value
            let [t1, c1] = infer(cond, env)
            let [t2, c2] = infer(tr, env)
            let [t3, c3] = infer(fl, env)
            let c4 = Constraint([t1, typeBool])
            let c5 = Constraint([t2, t3])
            return [t2, c1.concat(c2, c3, c4, c5)]
        }

        return UNREACHABLE(ex)
    }

let inferTop: (e: TypeEnv, o: [string, Expr][]) => TypeEnv
    = (env, exprs) => {
        if (exprs.length === 0)
            return env
        let [head, ...xs] = exprs
        let [name, ex] = head

        let ty = inferExpr(env, ex)
        return inferTop(extend(env, [name, ty]), xs)
    }

let normalize: (s: Scheme) => Scheme
    = (s) => {
        let [_, body] = s.value

        let fv = (a: TArr | TVar | TCon): string[] => match(a, {
            TVar: (a) => [a],
            TArr: ([a, b]) => [...fv(a), ...fv(b)],
            TCon: (_) => [],
        })

        let ord = zipp([...Set(fv(body))], letters)
        let ordIndex = Map(ord)

        let normType = (a: TArr | TVar | TCon): Type => match(a, {
            TArr: ([a, b]) => TArr([normType(a), normType(b)]),
            TCon: (a) => TCon(a),
            TVar: (a) => {
                let name = ordIndex.get(a)
                if (name == null)
                    throw new Error('Type Variable Not In Signature')
                return TVar(name)
            },
        })

        const tvars = ord.map(([, b]) => TVar(b))
        return ForAll([tvars, normType(body)])
    }
//#endregion

// ----------------------------------------------------------------------------
// -- Constraint Solver
// ----------------------------------------------------------------------------

//#region Solver
let emptySubst: () => Subst
    = () => Map<TVar, Type>()

let substOf: (v: TVar, t: Type) => Subst
    = (v, t) => Map([[v, t]])

let compose: (a: Subst, b: Subst) => Subst
    = (s1, s2) => mapUnion(mapMap(v => apply(s1, v), s2), s1)

let runSolve: (a: Constraint[]) => Subst
    = (cs) => solver([emptySubst(), cs])

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
                return substOf(a, t)
            }
        }
        return emptySubst()
    }

let occursCheck: (v: TVar, t: SubstitutableA) => boolean
    = (a, t) => setMember(a, ftv(t))
//#endregion

// ----------------------------------------------------------------------------
// -- Pretty Printer
// ----------------------------------------------------------------------------

//#region ppr

let ppr: (t: Type | Scheme | Expr) => string
    = t => t && matchExhaustive(t, {
        TCon: x => x,
        TVar: x => x,
        TArr: ([a, b]) => `${ppr(a)} -> ${ppr(b)}`,
        ForAll: ([a, b]) => {
            if (a.length === 0) return ppr(b)
            return `forall ${a.map(ppr).join(' ')}. ${ppr(b)}`
        },
        App: ([a, b]) => `(${ppr(a)} ${ppr(b)})`,
        Var: x => x,
        Lam: x => String(x),
        Let: x => String(x),
        If: x => String(x),
        Fix: x => String(x),
        Op: x => String(x),
        LBool: x => String(x),
        LInt: x => String(x),
    })

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
    ['add', TArr([TVar('a'), TVar('a')])],
];

let initenv = () => TypeEnv(Map<Name, Scheme>());

let env = builtins.reduce(extend, initenv())

type Binding = [string, Expr]

let decl: (ex: Expr, n?: string) => Binding
    = (ex, name) => [name ?? 'it', ex]

let sig

try {

    let tyCtx = inferTop(env, [
        // decl(Let(['id', Lam(['a', Var('a')]), App([LInt(5), LInt(5)])])),
        // decl(LInt(5)),
        // decl(App([Var('add'), LInt(5)])),
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

    tyCtx = inferTop(env, [
        decl(Var("true")),
    ])

    sig = ppsignature('it', tyCtx.value.get('it')!)
    sig

    sig = ppsignature('id', tyCtx.value.get('id')!)
    sig

    sig = ppsignature('add', tyCtx.value.get('add')!)
    sig

} catch (err) {
    err
    let val = err.value
    val
    console.log(err.value)
    console.log(err.stack)
    console.log(ppr(err.value))
}

//#endregion
