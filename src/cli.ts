import { AstInterpreter } from "./lib/AstInterpreter"
import { FileReader } from "./lib/FileReader"
import { StdOutPrinter } from "./lib/StdOutPrinter"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
// import { AstTypeChecker } from "./lib/TypeChecker"
import { HindleyMilner } from "./lib/HindleyMilner"
import { resolve as resolvePath } from "path"
import { ConsoleReporter } from "./lib/ConsoleReporter"

function main(args: string[]) {
    const debugMode = args.slice(1, -1)
        .find(o => ['--debug', '-D'].includes(o))

    const filename = resolvePath(args[args.length - 1])

    const reader = new FileReader(filename)
    const output = new StdOutPrinter()

    const reporter = new ConsoleReporter(reader, output)

    const lexer = new TokenLexer(reader)
    const tokens = lexer.lex()

    const parser = new TokenParser(tokens, reader)
    const ast = parser.parseProgram()

    reporter.reportParserErrors(parser, onError)

    // const typeChecker = new AstTypeChecker(reader)
    const typeChecker = new HindleyMilner(reader)

    const types = typeChecker.typecheck(ast)

    reporter.reportTypeErrors(typeChecker, onError)

    const interpreter = new AstInterpreter(reader)
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
main(['', '', '-D', '/Users/duroktar/code/BangaLang/tests/another-test-file.bl'])
// main(['', '', '-D', '/Users/duroktar/code/BangaLang/tests/simple-test.bl'])
