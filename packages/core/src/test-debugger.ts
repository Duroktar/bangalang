import { resolve as resolvePath } from "path"
import { AstDebuggableInterpreter } from "./lib/AstDebugger"
import { FileReader } from "./lib/FileReader"
import { GlobalTypes, HindleyMilner, TypeEnv } from "./lib/HindleyMilner"
import { findNodeForToken } from "./lib/QueryVisitor"
import { StdLib } from "./lib/StdLib"
import { ScopeResolver } from "./lib/ScopeResolver"
import { ConsoleReporter } from "./lib/ConsoleReporter"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
import { ConsoleLogger } from "./lib/ConsoleLogger"

function main(path: string) {
    const filename = resolvePath(path)

    const typeEnv = new TypeEnv(GlobalTypes)

    const reader = new FileReader(filename)
    const output = new ConsoleLogger()
    const reporter = new ConsoleReporter(reader, output)
    const lexer = new TokenLexer(reader)
    const parser = new TokenParser(reader)
    const typeChecker = new HindleyMilner(reader, typeEnv)
    const interpreter = new AstDebuggableInterpreter(StdLib)
    const resolver = new ScopeResolver(interpreter)

    const tokens = lexer.lex()
    const ast = parser.parse(tokens)

    reporter.reportParserErrors(parser, process.exit)

    resolver.resolve(ast)

    reporter.reportResolverErrors(resolver, process.exit)

    typeChecker.validate(ast)

    reporter.reportTypeErrors(typeChecker, process.exit)

    let finished = false

    interpreter.process.on('complete', () => {
        finished = true
    })

    interpreter.process.on('breakpoint-reached', () => {
        console.log('breakpoint-reached')
        interpreter.debugService.continue()
    })

    const breakpoint1 = findNodeForToken(ast, tokens[1])
    const breakpoint2 = findNodeForToken(ast, tokens[5])

    if (breakpoint1 && breakpoint2) {
        console.log('Breakpoint 1 set:', breakpoint1.toString())
        console.log('Breakpoint 2 set:', breakpoint2.toString())

        interpreter.debugService.addBreakpointOn(breakpoint1)
        interpreter.debugService.addBreakpointOn(breakpoint2)
    }

    const callback = async () => {
        if (finished) { return }
        setTimeout(callback, 50)
    }

    interpreter.interpret(ast)

    setTimeout(() => {
        interpreter.debugService.continue()
        callback()
    })
}

try {
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/another-test-file.bl')
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/simple-test.bl')
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/print-test.bl')
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/print-test-2.bl')
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/print-test-3.bl')
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/func-test.bl')
    // main('/Users/duroktar/code/BangaLang/packages/core/tests/case-test.bl')

    main('/Users/duroktar/code/BangaLang/packages/core/tests/debugger-test.bl')
} catch (err) {
    console.error(err)
}
