import { Declaration, FuncDeclaration } from '../Ast'
import { BangaCallable, Environment, ReturnValue } from '../interface/Runtime'
import { AstInterpreter } from './AstInterpreter'
import { zip } from './utils'
import { Project } from "ts-morph";
import { Interpreter } from '../interface/Interpreter';
import { IdentifierToken } from '../interface/Lexer';

export class BangaFunction implements BangaCallable {
    constructor(
        public decl: FuncDeclaration,
        public closure: Environment,
    ) {}
    checkArity(n: number): boolean {
        return this.decl.varargs || this.decl.params.length === n
    }
    call(i: Interpreter, args: Declaration[]): any | Promise<any> {
        const environment = createEnvironment(this.closure)

        zip(args, this.decl.params).forEach(
            ([arg, param]) => environment.define(param.value, arg))

        try {
            i.executeBlock(this.decl.body.stmts, environment)
        } catch (result) {
            if (result instanceof ReturnValue) {
                return result.value
            }
            throw result
        }

        return null
    }
    toString(): string {
        return `${this.decl.name.value}`
    }
    arity(): number | '...' {
        return this.decl.varargs ? '...' : this.decl.params.length
    }
}

export class AsyncBangaFunction extends BangaFunction {
    static from(func: BangaFunction) {
        return new AsyncBangaFunction(func.decl, func.closure)
    }

    async call(i: Interpreter, args: Declaration[]): Promise<any> {
        const environment = createEnvironment(this.closure)

        zip(args, this.decl.params).forEach(
            ([arg, param]) => environment.define(param.value, arg))

        try {
            await i.executeBlock(this.decl.body.stmts, environment)
        } catch (result) {
            if (result instanceof ReturnValue) {
                return result.value
            }
        }

        return null
    }
}

export class BangaPrintFunction implements BangaCallable {
    checkArity(n: number): boolean {
        return true
    }
    arity() {
        return '...' as const
    }
    call(i: AstInterpreter, args: object[]) {
        console.log(...args)
        return args.length
    }
    toString(): string {
        return 'print'
    }
}

export class BangaImportFunction implements BangaCallable {
    checkArity(n: number): boolean {
        return n === 1
    }
    arity() {
        return 1
    }
    call(i: AstInterpreter, args: object[]) {
        const [modulePath, ..._] = args
        if (typeof modulePath === 'string') {
            const code = require(modulePath) as Record<string, object>
            const imported: Record<string, any> = {}
            Object.entries(code)
                .forEach(([name, value]) => {
                    if (name.startsWith('_'))
                        return;

                    let rtVal;
                    if (typeof value === 'function')
                        rtVal = <BangaCallable>{
                            checkArity: (n) => n === n, // TODO
                            arity: () => '...',
                            call: (i, args) => value.apply(undefined, args),
                            toString: () => value.toString(),
                        }
                    if (typeof value === 'string')
                        rtVal = value
                    if (typeof value === 'number')
                        rtVal = value

                    if (rtVal !== undefined) {
                        i.environment.define(name, rtVal)
                        imported[name] = rtVal
                    }
                })

            const project = new Project({
                compilerOptions: {
                    allowJs: true,
                },
            });

            const mods = Object.keys(imported).map(n => `const ${n} = ${modulePath}.${n}`);
            const temp = `import * as ${modulePath} from '${modulePath}';\n${mods}`
            const srcFile = project.createSourceFile('temp.js', temp)
            let tc = project.getTypeChecker()

            let decls = srcFile.getVariableDeclarations()
            let exprts = decls.map(d => [d.getName(), tc.getTypeAtLocation(d)] as const)
            console.log('---------------------------------------------')
            // console.log(exprts.map(([n, e]) => `${n}: ${tc.getTypeText(e)}`))
            // console.log(exprts.map(([n, e]) => e.getCallSignatures().map(s => [s.getParameters().map(t => String(t)).join(', '), tc.getTypeText(s.getReturnType()), s.getDocumentationComments().map(s => s.getText()).join(', ') ])))
            exprts.map(([n, e]) => {
                let signatures = e.getCallSignatures().map(s => s.getParameters())
                signatures.forEach(params => {
                    params.forEach(param => {
                        const rrr = tc.getDeclaredTypeOfSymbol(param)
                        // console.log(e.compilerType.)
                        // console.log(param.getDeclaredType())
                        // console.log(rrr)
                        // console.log(rrr.getText())
                        // console.log(param.getAliasedSymbol())
                    })
                })
            })
            console.log('---------------------------------------------')
        }
        return args.length
    }
    toString(): string {
        return 'import'
    }
}

class Env implements Environment {
    constructor(public enclosing?: Environment) {}
    get(name: string) {
        if (this.values.has(name))
            return this.values.get(name)

        if (this.enclosing)
            return this.enclosing.get(name)

        throw new Error("(get) Undefined variable '" + name + "'.");
    }
    assign(name: IdentifierToken, value: any) {
        if (this.values.has(name.value))
            return this.values.set(name.value, value)

        if (this.enclosing)
            return this.enclosing.assign(name, value)

        throw new Error("(assign) Undefined variable '" + name.value + "'.");
    }
    define(name: string, value: any) {
        this.values.set(name, value)
    }
    has(name: string) {
        return this.values.has(name)
    }
    getAt(distance: number, name: string) {
        return this.ancestor(distance).values.get(name)
    }
    assignAt(distance: number, name: IdentifierToken, value: any) {
        this.ancestor(distance).values.set(name.value, value)
    }
    clear() {
        return this.values.clear()
    }
    entries() {
        return this.values.entries()
    }
    ancestor(distance: number) {
        let environment: Environment = this
        for (let i = 0; i < distance; i++) {
            environment = environment.enclosing!
        }

        return environment
    }

    public values: Map<string, any> = new Map()
}

export const createEnvironment: (d?: Environment) => Environment
    = (d?: Environment) => new Env(d)

export const StdLib: Environment = createEnvironment()
    StdLib.define('print',  new BangaPrintFunction())
    StdLib.define('import',  new BangaImportFunction())
