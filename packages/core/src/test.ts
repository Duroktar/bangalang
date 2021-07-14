import { resolve as resolvePath } from "path"
import { FileReader } from "./lib/FileReader"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
import { tryExpr, TypeEnv, TypeLib } from "./lib/FunctionalHM"
import { ConsoleReporter } from "./lib/SysReporter"

function main(filename: string) {

    const reader = new FileReader(resolvePath(filename))
    const reporter = new ConsoleReporter(reader, console)

    const tokens = new TokenLexer(reader).lex()
    const parser = new TokenParser(tokens, reader)
    const ast = parser.parseProgram()

    reporter.reportParserErrors(parser, process.exit)

    const typeEnv = new TypeEnv(TypeLib)

    for (let node of ast) {
        const type = tryExpr(node, typeEnv)
        const term = node.toString()
        console.log(type)
        console.log(term)
    }
}

main('/Users/duroktar/code/BangaLang/packages/core/tests/func-test.bl')
