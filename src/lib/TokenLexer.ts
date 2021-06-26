import type { Reader } from "../Reader"
import { Lexer, LexerError, OperatorType, Token, TokenType } from "../Lexer"

export class TokenLexer implements Lexer<Token[]> {
    constructor(public reader: Reader) { }

    lex() {
        while (!this.reader.atEOF) {
            const current = this.reader.peek()

            switch (current) {
                case '+':
                    this.parseOperator(TokenType.PLUS, current)
                    break;
                case ' ':
                case '\n':
                case '\t':
                    break;
                default: {
                    if (current.match(/\d/)) {
                        this.parseInt()
                        break
                    } else {
                        this.parseStr()
                        break
                    }
                }
            }

            this.reader.next()
        }

        return this.tokens;
    }

    private parseInt() {
        let res: string[] = []

        do {
            res.push(this.reader.next())
        }
        while (![' ', '\n'].includes(this.reader.peek()) && !this.reader.atEOF)

        const maybeNum = parseInt(res.join(''))

        if (Number.isNaN(maybeNum))
            throw new LexerError(`Not a number: ${res.join()}`)

        this.tokens.push({
            type: TokenType.NUMBER,
            value: maybeNum,
            raw: maybeNum.toString(),
        })
    }

    private parseStr() {
        let res: string = ""

        do {
            res += this.reader.next()
        }
        while (![' ', '\n'].includes(this.reader.peek()) && !this.reader.atEOF)

        this.tokens.push({
            type: TokenType.STRING,
            value: res,
            raw: res,
        })
    }

    private parseOperator(type: OperatorType, op: string) {
        this.tokens.push({ type, raw: op })
    }

    private tokens: Token[] = []
}
