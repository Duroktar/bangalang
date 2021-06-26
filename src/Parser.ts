import { LiteralToken, OperatorToken, Token } from "./Lexer"
import { Visitable, Visitor } from "./Visitor"

export class ParserError extends Error {}

export type Ast = Expression

export type Expression =
    | LiteralExpr
    | BinaryExpr

export class LiteralExpr implements Visitable {
    constructor(
        public token: LiteralToken,
    ) {}

    accept = (visitor: Visitor) => {
        return visitor.visitLiteralExpr(this)
    }
}

export class BinaryExpr implements Visitable {
    constructor(
        public left: Expression,
        public op: OperatorToken,
        public right: Expression,
    ) {}

    accept = (visitor: Visitor) => {
        return visitor.visitBinaryExpr(this)
    }
}

export interface Parser<I, O> {
    input: I
    parse(): O
}
