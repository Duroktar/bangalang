import { Interpreter } from "./interface/Interpreter";
import { Lexer } from "./interface/Lexer";
import { Logger } from "./interface/Logger";
import { Parser } from "./interface/Parser";
import { Reader } from "./interface/Reader";
import { Reporter } from "./interface/Reporter";
import { Resolver } from "./interface/Resolver";
import { TypeChecker } from "./interface/TypeCheck";

export type Deps<Tokens, Ast> = {
    reader: () => Reader
    logger: () => Logger
    reporter: (r: Reader, l: Logger) => Reporter<Tokens, Ast>
    lexer: (r: Reader) => Lexer<Tokens>
    parser: (r: Reader) => Parser<Tokens, Ast>
    resolver: (i: Interpreter) => Resolver<Ast>
    interpreter: (r: Reader) => Interpreter
    typechecker: (r: Reader) => TypeChecker<Ast>
};

export const bootstrap: <T, O>(d: Deps<T, O>) => (debugMode: boolean) => any
    = deps => (debugMode = false) => {

        const reader = deps.reader()
        const output = deps.logger()
        const reporter = deps.reporter(reader, output)
        const lexer = deps.lexer(reader)
        const parser = deps.parser(reader)
        const typeChecker = deps.typechecker(reader)
        const interpreter = deps.interpreter(reader)
        const resolver = deps.resolver(interpreter)

        const lexed = lexer.lex()
        const ast = parser.parse(lexed)

        reporter.reportParserErrors(parser, onError)

        resolver.resolve(ast)

        reporter.reportResolverErrors(resolver, onError)

        const types = typeChecker.validate(ast)

        reporter.reportTypeErrors(typeChecker, onError)

        interpreter.interpret(ast)

        if (debugMode) reporter.printFullReport(lexed, ast, types)


        function onError() {
            if (debugMode)
                reporter.printFullReport(lexed, ast, [])
            process.exit(1)
        }
    }
