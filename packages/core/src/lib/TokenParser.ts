import * as Ast from "../Ast";
import { LiteralToken, OperatorToken, Token, TokenOf, TokenKind, VariableToken, NumberToken, StringToken, getToken } from "../Lexer";
import { Parser, ParserError } from "../Parser";
import { underline } from "./utils";
import type { Reader } from "../Reader";

export class TokenParser implements Parser<Token[], object[]> {
    public errors: ParserError[] = []

    constructor(public input: Token[], private reader: Reader) {}

    hadErrors() {
        return this.errors.length != 0
    }

    parseProgram(): Ast.Program {
        const stmts: Ast.Program = []
        while (!this.isAtEnd())
            stmts.push(this.declaration())
        return stmts
    }

    declaration() {
        try {
            if (this.match(TokenKind.LET)) {
                return this.letDecl()
            }

            return this.statement()
        } catch (error) {
            this.errors.push(error)
            this.synchronize()
            return null as never
        }
    }

    letDecl() {
        const token = this.previous<TokenKind.LET>()
        const name = this.consume(TokenKind.IDENTIFIER, 'Expected variable name.')

        this.consume(TokenKind.EQUAL, "No un-initialized variables.")

        const init = this.expression()

        this.consume(TokenKind.SEMI, "Expected ';' after declaration.")

        return new Ast.LetDeclaration(name, init, token)
    }

    statement() {
        return this.exprStmt()
    }

    exprStmt() {
        const expr = this.expression()
        this.consume(TokenKind.SEMI, "Expected ';' after expression.")
        return new Ast.ExpressionStmt(expr, getToken(expr))
    }

    expression() {
        return this.assignment()
    }

    assignment(): Ast.Expression {
        const expr = this.term()
        if (this.match(TokenKind.EQUAL)) {
            const equals = this.previous()
            const value = this.assignment()
            if (!(expr instanceof Ast.VariableExpr)) {
                const rng = equals.lineInfo
                const src = this.reader.getLineOfSource(rng)
                const arrows = underline(rng)
                const msg = '- Invalid assignment target'
                const err = `\n${src}\n${arrows}\n${msg}`
                throw new ParserError(err, equals)
            }
            return new Ast.AssignExpr(expr.token, value)
        }
        return expr
    }

    term() {
        let left: any = this.primary()
        while (this.match(TokenKind.PLUS, TokenKind.MINUS)) {
            const op = <OperatorToken>this.previous()
            const right = this.primary()
            left = new Ast.BinaryExpr(left, op, right)
        }
        return left
    }

    primary() {
        if (this.match(TokenKind.TRUE))
            new Ast.LiteralExpr(true, 'true', <LiteralToken>this.previous())
        if (this.match(TokenKind.FALSE))
            new Ast.LiteralExpr(false, 'false', <LiteralToken>this.previous())

        if (this.match(TokenKind.NUMBER, TokenKind.STRING)) {
            const expr = <NumberToken | StringToken>this.previous()
            return new Ast.LiteralExpr(expr.value, expr.raw, expr)
        }

        if (this.match(TokenKind.IDENTIFIER)) {
            const token = <VariableToken>this.previous()
            return new Ast.VariableExpr(token.value, token)
        }

        if (this.match(TokenKind.PAREN_OPEN)) {
            const token = this.previous()
            const expr = this.expression()
            this.consume(TokenKind.PAREN_CLOSE, "Expect ')' after expression.")
            return new Ast.GroupingExpr(expr, token)
        }

        throw new ParserError(`Can't parse primary`, this.peek())
    }

    consume<T extends TokenKind>(tokenType: T, msg: string) {
        if (this.check(tokenType))
            return this.advance<T>()
        throw new ParserError(msg, this.previous() ?? this.peek())
    }

    private check(type: TokenKind): boolean {
        if (this.isAtEnd())
            return false
        return this.peek().kind === type
    }

    private advance<T extends TokenKind>(): TokenOf<T> {
        if (!this.isAtEnd())
            this.cursor++
        return this.previous()
    }

    private isAtEnd() {
        return this.peek().kind === TokenKind.EOF
    }

    private peek<T extends TokenKind>(): TokenOf<T> {
        return this.input[this.cursor] as TokenOf<T>
    }

    private previous<T extends TokenKind>(): TokenOf<T> {
        return this.input[this.cursor - 1] as TokenOf<T>
    }

    private match(...types: TokenKind[]) {
        for (let type of types) {
            if (this.check(type)) {
                this.advance()
                return true
            }
        }
        return false
    }

    private synchronize() {
        this.advance()
        while (!this.isAtEnd()) {
            if (this.previous().kind === TokenKind.SEMI)
                return

            switch (this.peek().kind) {
                // case TokenType...:
                //     return
            }

            this.advance()
        }
    }

    private cursor: number = 0
}
