import * as Ast from "../Ast";
import { LiteralToken, OperatorToken, Token, TokenOf, TokenKind, VariableToken, NumberToken, StringToken, getToken } from "../Lexer";
import { Parser, ParserError } from "../Parser";
import { underline } from "./utils";
import type { Reader } from "../Reader";
import { BlockStmt, Declaration, FuncDeclaration, LetDeclaration, Statement } from "../Ast";

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

    declaration(): Declaration {
        try {
            if (this.match(TokenKind.FUNC)) {
                return this.funcDecl('function')
            }
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

    funcDecl(kind: string): FuncDeclaration {
        const token = this.previous<TokenKind.FUNC>()
        const name = this.consume(TokenKind.IDENTIFIER, "Expected " + kind + " name.")
        
        this.consume(TokenKind.LEFT_PAREN, "Expected '(' after " + kind + " name")
        const parameters: VariableToken[] = []
        if (!this.check(TokenKind.RIGHT_PAREN)) {
            do {
                if (parameters.length >= 255)
                    throw new ParserError("Can't have more than 255 parameters.", this.peek())
                parameters.push(this.consume(TokenKind.IDENTIFIER, "Expected variable."))
            } while (this.match(TokenKind.COMMA))
        }
        this.consume(TokenKind.RIGHT_PAREN, "Expected ')' after parameters")

        this.consume(TokenKind.LEFT_BRACE, "Expected '{' before " + kind + " body")
        return new FuncDeclaration(name, parameters, new BlockStmt(this.block()), token);
    }

    letDecl(): LetDeclaration {
        const token = this.previous<TokenKind.LET>()
        const name = this.consume(TokenKind.IDENTIFIER, 'Expected variable name.')

        this.consume(TokenKind.EQUAL, "No un-initialized variables.")

        const init = this.expression()

        this.consume(TokenKind.SEMI, "Expected ';' after declaration.")

        return new Ast.LetDeclaration(name, init, token)
    }

    statement(): Statement {
        if (this.match(TokenKind.LEFT_BRACE)) {
            return new BlockStmt(this.block());
        }

        return this.exprStmt()
    }

    block() {
        const statements: Statement[] = []
        while (!this.check(TokenKind.RIGHT_BRACE) && !this.isAtEnd()) {
            statements.push(<Statement>this.declaration())
        }

        this.consume(TokenKind.RIGHT_BRACE, "Expected '}' after block.")
        return statements
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
        let left: any = this.call()
        while (this.match(TokenKind.PLUS, TokenKind.MINUS)) {
            const op = <OperatorToken>this.previous()
            const right = this.call()
            left = new Ast.BinaryExpr(left, op, right)
        }
        return left
    }

    call() {
        let expr: Ast.Expression = this.primary();

        while (true) { 
            if (this.match(TokenKind.LEFT_PAREN)) {
                expr = this.finishCall(expr);
            } else {
                break;
            }
        }
    
        return expr;
    }

    private finishCall(callee: Ast.Expression) {
        const args: Ast.Expression[] = [];
        if (!this.check(TokenKind.RIGHT_PAREN)) {
          do {
            if (args.length >= 255) {
                const msg = "Can't have more than 255 arguments.";
                throw new ParserError(msg, this.peek());
            }
            args.push(this.expression());
          } while (this.match(TokenKind.COMMA));
        }
    
        const paren = this.consume(TokenKind.RIGHT_PAREN,
                              "Expected ')' after args.");
    
        return new Ast.CallExpr(callee, paren, args);
        
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

        if (this.match(TokenKind.LEFT_PAREN)) {
            const token = this.previous()
            const expr = this.expression()
            this.consume(TokenKind.RIGHT_PAREN, "Expect ')' after expression.")
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
                case TokenKind.FUNC:
                case TokenKind.LET:
                case TokenKind.PRINT:
                case TokenKind.RETURN:
                    return
            }

            this.advance()
        }
    }

    private cursor: number = 0
}
