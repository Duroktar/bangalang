import * as Ast from "../Ast";
import type { Range, Token } from "../Lexer";
import type { Logger } from "../Logger";
import { Parser, ParserError } from "../Parser";
import type { Reader } from "../Reader";
import type { Reporter } from "../Reporter";
import { TypeChecker, TypeCheckError } from "../Types";
import { clamp, UNREACHABLE } from "./utils";

export class ConsoleReporter implements Reporter {
    constructor(public reader: Reader, public logger: Logger) {}

    printObject(result: object): void {
        this.logger.log(JSON.stringify(result, null, 4))
    }

    printFullReport(
        tokens: Token[],
        ast: Ast.Program,
        types: any,
        result?: any
    ): void {
        this.logger.log(JSON.stringify({
            // tokens,
            ast,
            types,
            result,
        }, null, 4))
    }

    reportParserErrors(parser: Parser<any, any>, onError: () => void, depth = 1) {
        if (parser.errors.length > 0) {
            let max = Math.min(depth, parser.errors.length)
            for (let i = max - 1; i >= 0; i--) {
                const error = parser.errors[i]
                if (error instanceof ParserError) {
                    this.logParserError(error);
                } else
                    console.error(error)
            }

            onError()
        }
    }

    private logParserError(error: ParserError) {
        let msg = ''
        if (error.token)
            msg += `\n${error.message}\n${underline(error.token.lineInfo)}`
        else
            msg += ` ${error.message}`
        console.error(msg)
    }

    reportTypeErrors(tc: TypeChecker, onError: () => void, depth = 1) {
        debugger
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
}

export function underline(range: Range, leftMargin = 0) {
    const numArrows = Math.abs(range.end.col - range.start.col)
    const space = ' '.repeat(clamp(0, Infinity, range.start.col - 1 + leftMargin))
    const arrows = '^'.repeat(clamp(0, Infinity, numArrows))
    return space + arrows
}

export function getToken(expr: Ast.Statement | Ast.Expression): Token {
    if (expr instanceof Ast.LiteralExpr) {
        return expr.token
    }

    if (expr instanceof Ast.BinaryExpr) {
        return newWithLineInfo(expr.op, {
            start: getToken(expr.left).lineInfo.start,
            end: getToken(expr.right).lineInfo.end,
        })
    }

    if (expr instanceof Ast.VariableExpr) {
        return expr.token
    }

    if (expr instanceof Ast.AssignExpr) {
        return expr.name
    }

    if (expr instanceof Ast.GroupingExpr) {
        return expr.token
    }

    if (expr instanceof Ast.LetDeclaration) {
        return expr.name
    }

    if (expr instanceof Ast.ExpressionStmt) {
        return expr.token
    }

    throw new Error('No token found for: ' + UNREACHABLE(expr))
}

export function lineInfo(expr: Ast.Statement | Ast.Expression): Range {
    return getToken(expr).lineInfo
}

const newWithLineInfo = <T extends Token>(expr: T, r: Range) =>
    Object.assign(expr, { lineInfo: r })
