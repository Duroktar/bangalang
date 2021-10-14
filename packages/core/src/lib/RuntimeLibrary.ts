import { Project, ts } from "ts-morph";
import { Declaration, FuncDeclaration } from '../Ast';
import { Interpreter } from '../interface/Interpreter';
import { BangaCallable, Environment, ReturnValue } from '../interface/Runtime';
import { AstInterpreter } from './AstInterpreter';
import { createEnvironment } from './Environment';
import { GlobalTypes, TypeEnv } from "./HindleyMilner";
import { TsTypeParser } from "./TsTypeParser";
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
    call(i: AstInterpreter, args: any[]) {
        console.log(...args)
        return args.length
    }
    toString(): string {
        return 'print'
    }
    type = GlobalTypes['print']
}

export class BangaNativeJsFunction implements BangaCallable {
    constructor(public value: Function) {}
    checkArity = (n: number) => { return this.varargs() || (n === this.value.length) }
    arity = () => this.value.length
    varargs = () => false
    call = (i: Interpreter, args: any[]) => this.value.apply(undefined, args)
    toString = () => this.value.toString()
}

export class BangaImportFunction implements BangaCallable {
    static typeParser = new TsTypeParser();
    static project = new Project({
        compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            lib: [
                'lib.esnext.full.d.ts',
            ],
        },
    });

    checkArity(n: number): boolean {
        return n === 1
    }
    arity() {
        return 1
    }
    call(i: Interpreter, args: any[]) {
        const [modulePath, ..._] = args

        if (typeof modulePath === 'string') {
            const code = require(modulePath) as Record<string, object>

            const imported: Record<string, any> = {}

            Object.entries(code)
                .forEach(([name, value]) => {
                    if (name.startsWith('_'))
                        return;

                    let rtVal;
                    switch(typeof value) {
                        case 'function':
                            rtVal = new BangaNativeJsFunction(value)
                            break
                        case 'string':
                        case 'number':
                        case 'boolean':
                            rtVal = value
                            break
                    }

                    if (rtVal !== undefined) {
                        i.globals.define(name, rtVal)
                        imported[name] = rtVal
                    }
                })
        }
    }

    declareImports(typeEnv: TypeEnv, args: any[]) {
        const [moduleName, ..._] = args

        const { typeParser, project } = BangaImportFunction;

        // https://stackoverflow.com/questions/39588436/how-to-parse-typescript-definition-to-json

        const temp =
              `import * as ${moduleName} from '${moduleName}';`
            + `declare let result: { [Key in keyof typeof ${moduleName}]: (typeof ${moduleName})[Key] };`

        const srcFile = project.createSourceFile(`${moduleName}.ts`, temp)

        const tc = project.getTypeChecker()

        const resultDec = srcFile.getVariableDeclarationOrThrow("result");
        const valueDeclaration = resultDec.getSymbolOrThrow().getValueDeclarationOrThrow();

        const formatFlags =
              ts.TypeFormatFlags.NoTruncation
            | ts.TypeFormatFlags.UseFullyQualifiedType

        const type = tc.getTypeAtLocation(resultDec);

        return type.getProperties()
            .reduce((acc, sym) => {
                const propName = sym.getName()
                const desc = propName.split(' ').map(o => o.trim())

                switch (desc[0]) {
                    case 'readonly':
                        desc.shift()
                    default: break
                }

                if (desc.length > 1) {
                    // console.error("can't handle type\n\t", prop)
                } else if (propName.startsWith('_')) {
                    // console.log("importing type\n\t", prop)
                } else {
                    // console.log("importing type\n\t", prop)
                    const typeName = tc.getTypeText(
                        tc.getTypeOfSymbolAtLocation(sym, valueDeclaration),
                        valueDeclaration,
                        formatFlags,
                    )
                    if (typeName.includes('import(')) {
                        // console.error("can't handle funky import type\n\t", prop)
                        return acc
                    }
                    if (typeName.startsWith('typeof')) {
                        // console.error("can't handle funky typeof stuff\n\t", prop)
                        return acc
                    }
                    const tsType = typeParser.parse(typeName);
                    if (tsType) {
                        const bangaType = typeParser.toBangaType(tsType)

                        const property = type.getProperty(propName)
                        const docLines = property?.compilerSymbol
                            .getDocumentationComment(tc.compilerObject)

                        const docs = docLines?.map(o => o.text).join('\n')
                        const label = typeParser.stringify(tsType)
                        typeEnv.extend(propName, Object.assign(bangaType, { docs, label }))
                    }
                    acc.push([propName, typeName])
                }
                return acc
            }, [] as [string, string][])
    }

    toString(): string {
        return 'import'
    }
}
