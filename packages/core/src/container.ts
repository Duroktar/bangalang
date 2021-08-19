import { Reader } from "./interface/Reader"
import { Logger } from "./interface/Logger";
import { Reporter } from "./interface/Reporter";
import { Lexer } from "./interface/Lexer";
import { Parser } from "./interface/Parser";
import { TypeChecker } from "./interface/TypeCheck";
import { Interpreter } from "./interface/Interpreter";

export type Deps<T, O> = {
    reader: () => Reader
    logger: () => Logger
    reporter: (r: Reader, l: Logger) => Reporter<T, O>
    lexer: (r: Reader) => Lexer<T>
    parser: (r: Reader) => Parser<T, O>
    typechecker: (r: Reader) => TypeChecker<O>
    interpreter: (r: Reader) => Interpreter
};

export const bootstrap: <T, O>(d: Deps<T, O>) => (debugMode: boolean) => any
    = deps => (debugMode = false) => {

        const reader = deps.reader()
        const output = deps.logger()

        const reporter = deps.reporter(reader, output)

        const lexer = deps.lexer(reader)
        const lexed = lexer.lex()

        const parser = deps.parser(reader)
        const ast = parser.parse(lexed)

        reporter.reportParserErrors(parser, onError)

        const typeChecker = deps.typechecker(reader)

        const types = typeChecker.validate(ast)

        reporter.reportTypeErrors(typeChecker, onError)

        const interpreter = deps.interpreter(reader)
        const result = interpreter.execute(ast)

        if (debugMode)
            reporter.printFullReport(lexed, ast, types, result)

        // ------------------------------
        function onError() {
            if (debugMode)
                reporter.printFullReport(lexed, ast, types, result)
            process.exit(1)
        }
    }
