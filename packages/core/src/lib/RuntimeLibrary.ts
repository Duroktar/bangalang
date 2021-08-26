import { Project } from "ts-morph";
import { Declaration, FuncDeclaration } from '../Ast';
import { Interpreter } from '../interface/Interpreter';
import { BangaCallable, Environment, ReturnValue } from '../interface/Runtime';
import { AstInterpreter } from './AstInterpreter';
import { createEnvironment } from './Environment';
import { GlobalTypes } from "./HindleyMilner";
import { zip } from './utils';

export class BangaFunction implements BangaCallable {
    constructor(
        public decl: FuncDeclaration,
        public closure: Environment,
    ) {}
    checkArity(n: number): boolean {
        return this.decl.varargs || this.decl.params.length === n
    }
    call = (i: Interpreter, args: Declaration[]): any | Promise<any> => {
        const environment = createEnvironment(this.closure)

        zip(args, this.decl.params).forEach(
            ([arg, param]) => environment.define(param.value, arg))

        try {
            i.executeBlock(this.decl.body.stmts, createEnvironment(environment))
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
    call = async (i: Interpreter, args: Declaration[]): Promise<any> => {
        const environment = createEnvironment(this.closure)

        zip(args, this.decl.params).forEach(
            ([arg, param]) => environment.define(param.value, arg))

        try {
            await i.executeBlock(this.decl.body.stmts, createEnvironment(environment))
        } catch (result) {
            if (result instanceof ReturnValue) {
                return result.value
            }

            throw result
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
    type = GlobalTypes['print']
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
    type = GlobalTypes['import']
}
