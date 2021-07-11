import type { Reader } from "../Reader"
import { KeywordType, Kinded, Lexer, LexerError, Position, Range, Token, TokenKind as _ } from "../Lexer"

export class TokenLexer implements Lexer<Token[]> {
    constructor(public reader: Reader) { }

    lex() {
        while (!this.atEOF()) {
            const current = this.peek()

            switch (current) {
                case '(': this.addToken(_.PAREN_OPEN); break;
                case ')': this.addToken(_.PAREN_CLOSE); break;
                case ';': this.addToken(_.SEMI); break;
                case '+': this.addToken(_.PLUS); break;
                case '-': this.addToken(_.MINUS); break;
                case '=': this.addToken(_.EQUAL); break;
                case ',': this.addToken(_.COMMA); break;
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

const keywordTypeMap = {
    'true': _.TRUE,
    'false': _.FALSE,
    'let': _.LET,
} as ObjOf<KeywordType>;

function getKeywordType(op: string) {
    return keywordTypeMap[op]
}

type ObjOf<T> = { [key: string]: T | undefined }
