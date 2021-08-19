import { Declaration, FuncDeclaration } from '../Ast'
import { BangaCallable, Environment, ReturnValue } from '../interface/Runtime'
import { AstInterpreter } from './AstInterpreter'
import { zip } from './utils'
import { Project } from "ts-morph";
import { Interpreter } from '../interface/Interpreter';

export class BangaFunction implements BangaCallable {
    constructor(
        public decl: FuncDeclaration,
        public closure: Environment,
    ) {}
    checkArity(n: number): boolean {
        return this.decl.varargs || this.decl.params.length === n
    }
    call(i: Interpreter, args: Declaration[]): any | Promise<any> {
        const environment = new Map(this.closure)

        zip(args, this.decl.params).forEach(
            ([param, name]) => environment.set(name.value, param))

        try {
            i.executeBlock(this.decl.body.stmts, environment)
        } catch (result) {
            if (result instanceof ReturnValue) {
                return result.value
            }
        }

        return null
    }
    toString(): string {
        return `${this.decl.name.value}/${this.arity()}`
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
        const environment = new Map(this.closure)

        zip(args, this.decl.params).forEach(
            ([param, name]) => environment.set(name.value, param))

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
        return `print/${this.arity()}`
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
                        i.environment.set(name, rtVal)
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
        return `import/1`
    }
}

export const StdLib: Environment = new Map<string, any>([
    ['print',  new BangaPrintFunction()],
    ['import', new BangaImportFunction()],
])

export const createEnvironment: (d?: Environment) => Environment
    = (d?: Environment) => d ? new Map(d.entries()) : new Map()
