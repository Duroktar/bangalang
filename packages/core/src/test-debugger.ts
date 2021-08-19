import { resolve as resolvePath } from "path"
import { AstDebuggableInterpreter } from "./lib/AstDebugger"
import { FileReader } from "./lib/FileReader"
import { GlobalTypes, HindleyMilner, TypeEnv } from "./lib/HindleyMilner"
import { findNodeForToken } from "./lib/QueryVisitor"
import { StdLib } from "./lib/RuntimeLibrary"
import { ConsoleReporter } from "./lib/SysReporter"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"

function main(args: string[]) {
    const debugMode = args
        .slice(1, -1)
        .some(o => ['--debug', '-D'].includes(o))

    const filename = resolvePath(args[args.length - 1])

    const reader = new FileReader(filename)
    const reporter = new ConsoleReporter(reader, console)

    const tokens = new TokenLexer(reader).lex()
    const parser = new TokenParser(reader)
    const ast = parser.parse(tokens)

    reporter.reportParserErrors(parser, process.exit)

    const typeEnv = new TypeEnv(GlobalTypes)
    const typeChecker = new HindleyMilner(reader, typeEnv)

    typeChecker.validate(ast)

    reporter.reportTypeErrors(typeChecker, process.exit)

    const interpreter = new AstDebuggableInterpreter(reader, StdLib)

    const breakpoint = findNodeForToken(ast, tokens[1])!
    const breakpoint2 = findNodeForToken(ast, tokens[5])!

    console.log('breakpoint:', breakpoint.toString())
    console.log('breakpoint2:', breakpoint2.toString())

    interpreter.debugService.addBreakpointOn(breakpoint)
    interpreter.debugService.addBreakpointOn(breakpoint2)

    interpreter.execute(ast)

    let finished = false
    interpreter.process.events.on('complete', () => {
        finished  = true
    })

    const callback = () => {
        interpreter.debugService.continue()
        if (finished) { return }
        setTimeout(callback, 5000)
    }

    setTimeout(callback, 5)
}

try {
    // main(process.argv)
    // main(['', '', '-D', '/Users/duroktar/code/BangaLang/packages/core/tests/another-test-file.bl'])
    // main(['', '', '-D', '/Users/duroktar/code/BangaLang/packages/core/tests/simple-test.bl'])
    // main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/print-test.bl'])
    // main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/print-test-2.bl'])
    // main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/print-test-3.bl'])
    // main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/func-test.bl'])
    // main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/case-test.bl'])

    main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/debugger-test.bl'])
} catch (err) {
    console.error(err)
}
