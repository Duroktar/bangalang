import { resolve as resolvePath } from "path"
import { AstInterpreter } from "./lib/AstInterpreter"
import { FileReader } from "./lib/FileReader"
import { GlobalTypes, HindleyMilner, TypeEnv } from "./lib/HindleyMilner"
import { StdLib } from "./lib/StdLib"
import { ScopeResolver } from "./lib/ScopeResolver"
import { ConsoleReporter } from "./lib/ConsoleReporter"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"

const debug = false

function main(filename: string) {
    const reader = new FileReader(resolvePath(filename))
    const reporter = new ConsoleReporter(reader, console)

    const tokens = new TokenLexer(reader).lex()
    const parser = new TokenParser(reader)
    const typeEnv = new TypeEnv(GlobalTypes)
    const typeChecker = new HindleyMilner(reader, typeEnv)
    const interpreter = new AstInterpreter(StdLib)
    const resolver = new ScopeResolver(interpreter)

    let errors = false

    const ast = parser.parse(tokens)

    reporter.reportParserErrors(parser, process.exit)

    resolver.resolve(ast)

    reporter.reportResolverErrors(resolver, () => errors = true)

    const types = typeChecker.validate(ast)

    reporter.reportTypeErrors(typeChecker, () => errors = true)

    if (!errors)
        interpreter.interpret(ast)

    if (debug) reporter.printFullReport(tokens, ast, types)
}

// main('/Users/duroktar/code/BangaLang/packages/core/tests/case-test.bl')
// main('/Users/duroktar/code/BangaLang/packages/core/tests/debugger-test.bl')
// main('/Users/duroktar/code/BangaLang/packages/core/tests/return-test.bl')
main('/Users/duroktar/code/BangaLang/packages/core/tests/if-test.bl')
