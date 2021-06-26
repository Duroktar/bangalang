
import { AstInterpreter } from "./lib/AstInterpreter"
import { FileReader } from "./lib/FileReader"
import { TokenLexer } from "./lib/TokenLexer"
import { TokenParser } from "./lib/TokenParser"
import { AstTypeChecker } from "./lib/TypeChecker"

function main(args: string[]) {
    const filename = args[2]

    const reader = new FileReader(filename)

    const lexer = new TokenLexer(reader)
    const tokens = lexer.lex();
    
    const parser = new TokenParser(tokens)
    const ast = parser.parse();

    const typeChecker = new AstTypeChecker()
    const types = typeChecker.typecheck(ast)

    const interpreter = new AstInterpreter()
    const result = interpreter.interpret(ast)
    
    console.log(result)
}

// main(process.argv)
main(['', '', '/Users/duroktar/code/BangaLang/test-file.bl'])
// main(['', '', 'test-file-with-error.bl'])
