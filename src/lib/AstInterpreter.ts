import { TokenType } from "../Lexer";
import type { LiteralExpr, BinaryExpr, Expression } from "../Parser";
import type { Reader } from "../Reader";
import type { Visitor } from "../Visitor";

export class AstInterpreter implements Visitor {
    constructor(private reader: Reader) {}

    visitLiteralExpr(node: LiteralExpr) {
        return node.token.value
    }
    visitBinaryExpr(node: BinaryExpr) {
        const left = this.interpret(node.left)
        const right = this.interpret(node.right)
        switch (node.op.type) {
            case TokenType.PLUS:
                return <any>left + <any>right
            case TokenType.MINUS:
                return <any>left - <any>right
        }
    }

    interpret(node: Expression): object {
        return node.accept(this)
    }
}
