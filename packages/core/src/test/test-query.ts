import { resolve as resolvePath } from "path"
import { ConsoleReporter } from "../lib/ConsoleReporter"
import { FileReader } from "../lib/FileReader"
import { querySelectorAll } from "../lib/QueryVisitor"
import { TokenLexer } from "../lib/TokenLexer"
import { TokenParser } from "../lib/TokenParser"

function main(filename: string) {
    const reader = new FileReader(resolvePath(filename))
    const reporter = new ConsoleReporter(reader, console)

    const tokens = new TokenLexer(reader).lex()
    const parser = new TokenParser(reader)

    const ast = parser.parse(tokens)

    reporter.reportParserErrors(parser, process.exit)

    const results = querySelectorAll(ast, ['.let'])
    console.log(results)
}

main('/Users/duroktar/code/BangaLang/packages/core/tests/query-test.bl')
