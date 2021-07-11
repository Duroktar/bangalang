import ObjectExplorer from "./object-explorer"
import { AstInterpreter, ConsoleLogger, HindleyMilner, SourceReader, TokenLexer, TokenParser, WebReporter } from "@bangalang/core"

const inputEl = document.querySelector<HTMLInputElement>('#input')!;
const outputEl = document.querySelector<HTMLDivElement>('.output')!;
const execButtonEl = document.querySelector<HTMLButtonElement>('#exec')!;

window.addEventListener('load', () => {

    execButtonEl.addEventListener('pointerup', () => {

        const reader = new SourceReader(inputEl.value!);
        const output = new ConsoleLogger();

        const reporter = new WebReporter(reader, output);

        const lexer = new TokenLexer(reader);
        const tokens = lexer.lex();

        const parser = new TokenParser(tokens, reader);
        const ast = parser.parseProgram();

        reporter.reportParserErrors(parser, onError);

        const typeChecker = new HindleyMilner(reader);
        const types = typeChecker.typecheck(ast);

        reporter.reportTypeErrors(typeChecker, onError);

        const interpreter = new AstInterpreter(reader);
        const result = interpreter.execute(ast);

        reporter.printFullReport(tokens, ast, types, result);

        while (outputEl.hasChildNodes()) {
            outputEl.removeChild(outputEl.lastChild!)
        }

        const oe = new ObjectExplorer({ tokens, ast, types, result });
        oe.appendTo(outputEl);

        // ------------------------------
        function onError() {
            reporter.printFullReport(tokens, ast, types);
            alert(JSON.stringify({ tokens, ast, types, result }, null, 4));
        }
    })
})
