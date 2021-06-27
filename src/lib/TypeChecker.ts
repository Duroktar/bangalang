import { bold, red, yellow } from "chalk"
import { TokenType } from "../Lexer"
import { Ast, BinaryExpr, Expression, LiteralExpr } from "../Parser"
import type { Reader } from "../Reader"
import { TypeChecker, TypeCheckError, TypeName, WithType } from "../Types"
import type { Visitable } from "../Visitor"
import { lineInfo, underline } from "./ErrorReporter"

export class AstTypeChecker implements TypeChecker {
    constructor(private reader: Reader) {}

    public errors: TypeCheckError[] = []

    typecheck(program: Ast): WithType<Ast> {
        return this.visit(program)
    }

    visitLiteralExpr(node: LiteralExpr) {
        const type = { type: this.infer(node) }
        return Object.assign(node, type)
    }

    visitBinaryExpr(node: BinaryExpr) {
        const left = this.visit(node.left)
        const right = this.visit(node.right)
        const type = { type: this.unify(left, right) }
        return Object.assign(node, type)
    }

    infer(literal: LiteralExpr): TypeName {
        switch (literal.token.type) {
            case TokenType.NUMBER:
                return TypeName.NUMBER
            case TokenType.STRING:
                return TypeName.STRING
            default:
                throw new TypeCheckError(
                    `!LITERAL: ${literal.token}`
                )
        }
    }

    unify(expr1: WithType<Expression>, expr2: WithType<Expression>): TypeName {
        if (expr1.type !== expr2.type) {
            const typeError = this.formatTypeError(expr1, expr2)
            this.errors.push(new TypeCheckError(typeError))
            return TypeName.NEVER
        }

        return expr1.type;
    }

    visit<T extends Visitable>(node: T): WithType<T> {
        return node.accept(this)
    }

    private formatTypeError = (
        expr1: WithType<Expression>,
        expr2: WithType<Expression>,
    ): string | string[] => {
        const lineInfoExpr1 = lineInfo(expr1), lineInfoExpr2 = lineInfo(expr2);
        const columnRange = `${lineInfoExpr1.start.col}-${lineInfoExpr2.end.col}`
        return [
            `${this.reader.srcpath} (${lineInfoExpr1.start.line}:${columnRange})`,
            ' ',
            this.reader.getLineOfSource(lineInfoExpr1),
            (
                red(underline(lineInfoExpr1))
                +
                yellow(underline(lineInfoExpr2, -(lineInfoExpr1.end.col - 1)))
            ),
            ' ',
            '- ' + bold(`A ${red(expr1.type)} type can't be used with a ${yellow(expr2.type)} type`),
        ]
    }
}
