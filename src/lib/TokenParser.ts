import type { Expression, Parser } from "../Parser";
import { BinaryExpr, LiteralExpr, ParserError } from "../Parser";
import { LiteralToken, OperatorToken, Token, TokenType } from "../Lexer";

export class TokenParser implements Parser<Token[], Expression> {
    constructor(public input: Token[]) {}

    parse() {
        return this.expression()
    }

    expression() {
        return this.binaryExpr()
    }

    binaryExpr() {
        let left: any = this.literalExpr()
        while (this.match(TokenType.PLUS)) {
            const op = <OperatorToken>this.previous()
            const right = this.literalExpr()
            left = new BinaryExpr(left, op, right)
        }
        return left
    }

    literalExpr() {
        if (this.match(TokenType.NUMBER, TokenType.STRING))
            return new LiteralExpr(<LiteralToken>this.previous())

        throw new ParserError(`Woops: ${this.peek()}`)
    }


    private check(type: TokenType) {
        if (this.isAtEnd())
            return false
        return this.peek().type === type
    }

    private advance() {
        if (!this.isAtEnd())
            this.cursor++
        return this.previous()
    }

    private isAtEnd() {
        return this.cursor >= this.input.length
    }

    private peek() {
        return this.input[this.cursor]
    }

    private previous() {
        return this.input[this.cursor - 1]
    }

    private match(...types: TokenType[]) {
        for (let type of types) {
            if (this.check(type)) {
                this.advance()
                return true
            }
        }
        return false
    }

    private cursor: number = 0
}
