import { resolve as resolvePath } from "path"
import { FileReader } from "./lib/FileReader"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
import { GlobalTypes, HindleyMilner, TypeEnv } from "./lib/HindleyMilner"
import { ConsoleReporter } from "./lib/SysReporter"

function main(filename: string) {

    const reader = new FileReader(resolvePath(filename))
    const reporter = new ConsoleReporter(reader, console)

    const tokens = new TokenLexer(reader).lex()
    const parser = new TokenParser(reader)
    const ast = parser.parse(tokens)

    reporter.reportParserErrors(parser, process.exit)

    const typeEnv = new TypeEnv(GlobalTypes)
    const typeChecker = new HindleyMilner(reader, typeEnv)

    const types = typeChecker.validate(ast)

    reporter.reportTypeErrors(typeChecker, process.exit)

    reporter.printFullReport(tokens, ast, types, /* result */)
}

main('/Users/duroktar/code/BangaLang/packages/core/tests/case-test.bl')
