import type { Reader } from "../interface/Reader"
import { getKeywordType, Lexer, LexerError, Position, Range, Token, TokenKind as _ } from "../interface/Lexer"

export class TokenLexer implements Lexer<Token[]> {
    constructor(public reader: Reader) { }

    lex() {
        while (!this.atEOF()) {
            const current = this.peek()

            switch (current) {
                case '(': this.addToken(_.LEFT_PAREN); break;
                case ')': this.addToken(_.RIGHT_PAREN); break;
                case '{': this.addToken(_.LEFT_BRACE); break;
                case '}': this.addToken(_.RIGHT_BRACE); break;
                case ';': this.addToken(_.SEMI); break;
                case '+': this.addToken(_.PLUS); break;
                case '=': this.addToken(_.EQUAL); break;
                case ',': this.addToken(_.COMMA); break;
                case '-': {
                    if (this.peekAhead() === '>') {
                        this.advance();
                        this.addToken(_.ARROW);
                    } else {
                        this.addToken(_.MINUS);
                    }
                    break;
                }
                case '"':
                case "'":
                    this.parseStr(current)
                    break;
                case '\n':
                    this.reader.incrementLineNo()
                case ' ':
                case '\r':
                case '\t':
                    this.advance()
                    break;
                case '/':
                    if (this.peekAhead() === '/') {
                        this.comment();
                        break
                    }
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

        const lineInfo = this.finishLineInfo(this.getPosition())

        this.tokens.push({ kind: _.EOF, lineInfo })

        return this.tokens;
    }

    comment() {
        while (!this.atEOF() && !this.peek().match(/[\n\r]/))
            this.advance()
    }

    private addToken<T extends Exclude<Token, { value: any }>>(kind: T['kind']) {
        const start = this.getPosition()

        this.advance()

        this.tokens.push({
            kind,
            lineInfo: this.finishLineInfo(start)
        })
    }

    private parseId() {
        let value: string = ""
        const start = this.getPosition()

        do {
            value += this.advance()
        }
        while (
            !this.atEOF()
            && this.peek().match(/[A-z_]/)
        )

        const keywordType = getKeywordType(value)
        const lineInfo = this.finishLineInfo(start)

        if (keywordType) {
            return this.tokens.push({
                kind: keywordType,
                value,
                lineInfo,
            })
        }

        // not a keyword (ie: it's an identifier)
        return this.tokens.push({
            kind: _.IDENTIFIER,
            value,
            lineInfo,
        })
    }

    private parseInt() {
        const res: string[] = []
        const start = this.getPosition()

        while (this.peek().match(/[0-9]/)) {
            res.push(this.advance())
            if (this.peek() === '.' && this.peekAhead().match(/[0-9]/)) {
                res.push(this.advance())
                while (this.peek().match(/[0-9]/)) {
                    res.push(this.advance())
                }
            }
        }

        const rawValue = res.join('');
        const maybeNum = parseFloat(rawValue)

        if (Number.isNaN(maybeNum))
            throw new LexerError(`Not a number: ${rawValue}`)

        this.tokens.push({
            kind: _.NUMBER,
            value: maybeNum,
            raw: rawValue,
            lineInfo: this.finishLineInfo(start),
        })
    }

    private parseStr(delim: string) {
        let res: string = ""
        let start = this.getPosition()

        do {
            res += this.advance()
        }
        while (
            !this.atEOF()
            && !this.peek().match(delim)
        )

        res += this.advance()

        this.tokens.push({
            kind: _.STRING,
            value: res.slice(1, -1),
            raw: res,
            lineInfo: this.finishLineInfo(start),
        })
    }

    private finishLineInfo(start: Position): Range {
        return { start, end: this.getPosition() };
    }

    private getPosition() {
        return {
            line: this.reader.lineNo,
            col: this.reader.columnNo,
        }
    }

    private advance() {
        return this.reader.next()
    }

    private peek() {
        return this.reader.peek()
    }

    private peekAhead() {
        return this.reader.peekAhead()
    }

    private atEOF() {
        return this.reader.atEOF
    }

    private tokens: Token[] = []
}
