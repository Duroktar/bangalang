import type { Reader } from "../Reader"
import { Lexer, LexerError, OperatorType, Token, TokenType } from "../Lexer"

export class TokenLexer implements Lexer<Token[]> {
    constructor(public reader: Reader) { }

    lex() {
        while (!this.reader.atEOF) {
            const current = this.reader.peek()

            switch (current) {
                case '+':
                case '-':
                case '=':
                    this.parseOperator(current)
                    break;
                case '"':
                case "'":
                    this.parseStr(current)
                    break;
                case '\n':
                    this.reader.incrementLineNo()
                case ' ':
                case '\t':
                    this.reader.next()
                    break;
                default: {
                    if (current.match(/\d/)) {
                        this.parseInt()
                        break
                    } else {
                        this.parseId()
                        break
                    }
                }
            }
        }

        this.tokens.push({ type: TokenType.EOF })
        return this.tokens;
    }

    private parseId() {
        let res: string = ""
        let lineInfo = { start: this.lineInfo() }

        do {
            res += this.reader.next()
        }
        while (
            !this.reader.atEOF
            && this.reader.peek().match(/[^\s\n]/)
        )

        this.reader.next()

        // TODO:
        // this.tokens.push({
        //     type: TokenType.IDENTIFIER,
        //     value: res,
        //     raw: res,
        // })
    }

    private parseInt() {
        let res: string[] = []
        let lineInfo = { start: this.lineInfo() }
    
        do {
            res.push(this.reader.next())
        }
        while (
            !this.reader.atEOF
            && this.reader.peek().match(/[^\s\n]/)
        )

        const maybeNum = parseInt(res.join(''))

        if (Number.isNaN(maybeNum))
            throw new LexerError(`Not a number: ${res.join()}`)

        this.tokens.push({
            type: TokenType.NUMBER,
            value: maybeNum,
            raw: maybeNum.toString(),
            lineInfo: {
                ...lineInfo,
                end: this.lineInfo(),
            }
        })

        this.reader.next()
    }

    private parseStr(delim: string) {
        let res: string = ""
        let lineInfo = { start: this.lineInfo() }

        do {
            res += this.reader.next()
        }
        while (
            !this.reader.atEOF
            && !this.reader.peek().match(delim)
        )

        res += this.reader.next()

        this.tokens.push({
            type: TokenType.STRING,
            value: res.slice(1, -1),
            raw: res,
            lineInfo: {
                ...lineInfo,
                end: this.lineInfo(),
            }
        })

        this.reader.next()
    }

    private parseOperator(op: string) {
        let lineInfo = { start: this.lineInfo() }
    
        this.reader.next()
    
        this.tokens.push({
            type: getOpType(op),
            raw: op,
            lineInfo: {
                ...lineInfo,
                end: this.lineInfo(),
            }
        })
    }

    private lineInfo() {
        return {
            line: this.reader.lineNo,
            col: this.reader.columnNo,
        }
    }

    private tokens: Token[] = []
}

function getOpType(op: string): OperatorType {
    const res = {
        '+': TokenType.PLUS,
        '-': TokenType.MINUS,
        '=': TokenType.EQUAL,
    }[op]

    if (res === undefined)
        throw new LexerError(`invalid operator type: ${op}`)

    return res as OperatorType
}

