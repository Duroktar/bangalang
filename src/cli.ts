
import { AstInterpreter } from "./lib/AstInterpreter"
import { FileReader } from "./lib/FileReader"
import { StdOutPrinter } from "./lib/StdOutPrinter"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
import { AstTypeChecker } from "./lib/TypeChecker"
import { resolve as resolvePath } from "path"
import { ErrorReporter } from "./lib/ErrorReporter"

function main(args: string[]) {
    const filename = resolvePath(args[2])

    const reader = new FileReader(filename)
    const printer = new StdOutPrinter()

    const reporter = new ErrorReporter(reader)

    const lexer = new TokenLexer(reader)
    const tokens = lexer.lex();

    const parser = new TokenParser(tokens, reader)
    const ast = parser.parse();

    const typeChecker = new AstTypeChecker(reader)
    const types = typeChecker.typecheck(ast)

    reporter.reportTypeErrors(typeChecker)

    const interpreter = new AstInterpreter(reader)
    const result = interpreter.interpret(ast)

    printer.log(result)

    process.exit(0)
}

// main(process.argv)
// main(['', '', '/Users/duroktar/code/BangaLang/test-file.bl'])
main(['', '', 'test-file-with-error.bl'])
