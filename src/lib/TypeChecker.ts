import { TokenType } from "../Lexer"
import type { BinaryExpr, Expression, LiteralExpr, Ast } from "../Parser"
import type { Visitable } from "../Visitor"
import { TypeChecker, TypeName, TypeCheckError, WithType } from "../Types"

export class AstTypeChecker implements TypeChecker {
    typecheck(program: Ast): WithType<Ast> {
        return this.visit(program)
    }

    visitLiteralExpr(node: LiteralExpr) {
        return { ...node, type: this.infer(node) }
    }

    visitBinaryExpr(node: BinaryExpr) {
        const left = this.visit(node.left)
        const right = this.visit(node.right)
        return { ...node, type: this.unify(left, right) }
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
            throw new TypeCheckError(`${expr1.type} !== ${expr2.type}`)
        }
        
        return expr1.type;
    }

    visit<T extends Visitable>(node: T): WithType<T> {
        return node.accept(this)
    }
}
