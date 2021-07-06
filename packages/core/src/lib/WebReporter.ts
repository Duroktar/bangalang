import * as Ast from "../Ast";
import { lineInfo, Token } from "../Lexer";
import type { Logger } from "../Logger";
import { Parser, ParserError } from "../Parser";
import type { Reader } from "../Reader";
import type { Reporter } from "../Reporter";
import { TypeChecker, TypeCheckError, WithType } from "../Types";
import { StringBuilder, underline } from "./utils";

export class WebReporter implements Reporter {
    constructor(public reader: Reader, public logger: Logger) {}

    printObject(result: object): void {
        this.logger.log(result)
    }

    printFullReport(
        tokens: Token[],
        ast: Ast.Program,
        types: any,
        result?: any
    ): void {
        this.logger.log({
            tokens,
            ast,
            types,
            result,
        })
    }

    reportParserErrors(parser: Parser<any, any>, onError: () => void, depth = 1) {
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

    reportTypeErrors(tc: TypeChecker, onError: () => void, depth = 1) {
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
        const columnRange = `${lineInfoExpr1.start.col}-${(lineInfoExpr2.end.col)}`
        const redArrows = (underline(lineInfoExpr1))
        const yellowArrows = (underline(lineInfoExpr2, -(lineInfoExpr1.end.col - 1)))
        const linerange = `${(lineInfoExpr1.start.line)}:${columnRange}`
        const help = (`The type ${(expr2.type)} can't be used in place of the type ${(expr1.type)}`)

        return new StringBuilder()
            .addLine(`/ (${linerange}) - ${('error')}: ${msg ?? help}`)
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
