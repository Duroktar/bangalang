import { bold, cyan, red, yellow, yellowBright } from "chalk";
import { relative } from "path";
import * as Ast from "../Ast";
import { lineInfo, Token } from "../interface/Lexer";
import type { Logger } from "../interface/Logger";
import { Parser, ParserError } from "../interface/Parser";
import type { Reader } from "../interface/Reader";
import type { Reporter } from "../interface/Reporter";
import { ResolutionError, Resolver } from "../interface/Resolver";
import { TypeChecker, TypeCheckError, WithType } from "../interface/TypeCheck";
import { StringBuilder, underline } from "./utils";

export class ConsoleReporter implements Reporter<Token[], Ast.Program> {
    constructor(public reader: Reader, public logger: Logger) {}

    printObject(result: object): void {
        this.logger.log(JSON.stringify(result, null, 4))
    }

    printFullReport(
        tokens: Token[],
        ast: Ast.Program,
        types: any,
    ): void {
        this.printObject({
            // tokens,
            ast,
            types,
        })
    }

    reportParserErrors(parser: Parser<any, any>, onError: () => void, depth = 5) {
        if (parser.errors.length > 0) {
            let max = Math.min(depth, parser.errors.length)
            for (let i = max - 1; i >= 0; i--) {
                const error = parser.errors[i]
                if (error instanceof ParserError) {
                    this._logParserError(error);
                } else
                    console.error(error)
            }

            onError()
        }
    }

    reportResolverErrors(resolver: Resolver<any>, onError: () => void, depth = 5): void {
        if (resolver.errors.length > 0) {
            let max = Math.min(depth, resolver.errors.length)
            for (let i = max - 1; i >= 0; i--) {
                const error = resolver.errors[i]
                console.error('[ResolverError]:', error.message)
            }

            onError()
        }
    }

    reportTypeErrors(tc: TypeChecker<Ast.Program>, onError: () => void, depth = 5) {
        if (tc.errors.length > 0) {
            let max = Math.min(depth, tc.errors.length)
            for (let i = max - 1; i >= 0; i--) {
                const error = tc.errors[i]
                if (error instanceof TypeCheckError)
                    console.error(error.message)
                else
                    console.error(error)
            }

            onError()
        }
    }

    formatTypeError(
        reader: Reader,
        expr1: WithType<Ast.Expression>,
        expr2: WithType<Ast.Expression>,
        msg?: string,
    ): string {
        const lineInfoExpr1 = lineInfo(expr1), lineInfoExpr2 = lineInfo(expr2);
        const columnRange = `${yellow(lineInfoExpr1.start.col)}-${yellow(lineInfoExpr2.end.col)}`
        const redArrows = red(underline(lineInfoExpr1))
        const yellowArrows = yellowBright(underline(lineInfoExpr2, -(lineInfoExpr1.end.col - 1)))
        const filepath = cyan(relative(process.cwd(), reader.srcpath))
        const linerange = `${yellow(lineInfoExpr1.start.line)}:${columnRange}`
        const help = bold(`The type ${yellowBright(expr2.type)} can't be used in place of the type ${red(expr1.type)}`)

        return new StringBuilder()
            .addLine(`${filepath} (${linerange}) - ${red('error')}: ${msg ?? help}`)
            .addLine(' ')
            .addLine('\t' + reader.getLineOfSource(lineInfoExpr1))
            .addLine('\t' + `${redArrows}${yellowArrows}`)
            .addLine(' ')
            .addLine('Hint: ' + help)
            .build()
    }

    private _logParserError(error: ParserError) {
        let msg = ''
        if (error.token)
            msg += `\n${error.message}\n${underline(error.token.lineInfo)}`
        else
            msg += ` ${error.message}`
        console.error(msg)
    }
}
