import { resolve as resolvePath } from "path"
import { AstInterpreter } from "./lib/AstInterpreter"
import { FileReader } from "./lib/FileReader"
import { ConsoleLogger } from "./lib/ConsoleLogger"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
import { GlobalTypes, HindleyMilner } from "./lib/HindleyMilner"
import { ConsoleReporter } from "./lib/SysReporter"
import { StdLib } from "./lib/RuntimeLibrary"

function main(args: string[]) {
    const debugMode = args.slice(1, -1)
        .find(o => ['--debug', '-D'].includes(o))

    const filename = resolvePath(args[args.length - 1])

    const reader = new FileReader(filename)
    const output = new ConsoleLogger()

    const reporter = new ConsoleReporter(reader, output)

    const lexer = new TokenLexer(reader)
    const tokens = lexer.lex()

    const parser = new TokenParser(tokens, reader)
    const ast = parser.parseProgram()

    reporter.reportParserErrors(parser, onError)

    const typeChecker = new HindleyMilner(reader, GlobalTypes)

    const types = typeChecker.typecheck(ast)

    reporter.reportTypeErrors(typeChecker, onError)

    const interpreter = new AstInterpreter(reader, StdLib)
    const result = interpreter.execute(ast)

    if (debugMode)
        reporter.printFullReport(tokens, ast, types, result)

    output.log(result.slice(-1).pop())

    return process.exit(0)

    // ------------------------------
    function onError() {
        if (debugMode)
            reporter.printFullReport(tokens, ast, types)
        process.exit(1)
    }
}

// main(process.argv)
// main(['', '', '-D', '/Users/duroktar/code/BangaLang/packages/core/tests/another-test-file.bl'])
// main(['', '', '-D', '/Users/duroktar/code/BangaLang/packages/core/tests/simple-test.bl'])
// main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/print-test.bl'])
main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/print-test-2.bl'])
