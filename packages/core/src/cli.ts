import { resolve as resolvePath } from "path"
import { Program } from "./Ast"
import { bootstrap } from "./bootstrap"
import { Token } from "./interface/Lexer"
import { AstInterpreter } from "./lib/AstInterpreter"
import { ConsoleLogger } from "./lib/ConsoleLogger"
import { FileReader } from "./lib/FileReader"
import { GlobalTypes, HindleyMilner, TypeEnv } from "./lib/HindleyMilner"
import { ScopeResolver } from "./lib/ScopeResolver"
import { StdLib } from "./lib/RuntimeLibrary"
import { ConsoleReporter } from "./lib/ConsoleReporter"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"

function main(args: string[]) {
    const debugMode = args
        .slice(1, -1)
        .some(o => ['--debug', '-D'].includes(o))

    const filename = resolvePath(args[args.length - 1])

    const typeEnv = new TypeEnv(GlobalTypes)

    return bootstrap<Token[], Program>({
        reader: ()       => new FileReader(filename),
        logger: ()       => new ConsoleLogger(),
        reporter: (r, l) => new ConsoleReporter(r, l),
        lexer: (r)       => new TokenLexer(r),
        parser: (r)      => new TokenParser(r),
        typechecker: (r) => new HindleyMilner(r, typeEnv),
        interpreter: (r) => new AstInterpreter(r, StdLib),
        resolver: (i)    => new ScopeResolver(i),
    })(debugMode)
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

    // main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/import-test.bl'])
    main(['', '', '', '/Users/duroktar/code/BangaLang/packages/core/tests/debugger-test.bl'])
} catch (err) {
    console.error(err)
}
