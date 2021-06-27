import type { Range } from "../Lexer";
import { BinaryExpr, Expression, LiteralExpr } from "../Parser";
import { Reader } from "../Reader";
import { TypeChecker } from "../Types";

export class ErrorReporter {
    constructor(public reader: Reader) {}

    reportTypeErrors(tc: TypeChecker, depth = 1) {
        if (tc.errors.length > 0) {
            let max = Math.min(depth, tc.errors.length)
            for (let i = max - 1; i >= 0; i--) {
                const error = tc.errors[i]
                console.error('[TypeError]:', error.message)
                console.error()
            }

            process.exit(1)
        }
    }
}

export function underline(range: Range, leftMargin = 0) {
    const numArrows = Math.abs(range.end.col - range.start.col)
    const space = ' '.repeat(range.start.col - 1 + leftMargin)
    const arrows = '^'.repeat(numArrows)
    return space + arrows
}

export function lineInfo(expr: Expression) {
    if (expr instanceof LiteralExpr) {
        return expr.token.lineInfo
    }

    if (expr instanceof BinaryExpr) {
        return expr.op.lineInfo
    }

    throw new Error('not reachable')
}
