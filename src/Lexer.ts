import type { Reader } from "./Reader";

export class LexerError {
    constructor(
        public message: string,
        public token?: Token,
    ) { }
}


export enum TokenKind {
    // literals
    STRING ='string',
    NUMBER ='number',
    IDENTIFIER ='identifier',

    // single character tokens
    PAREN_OPEN ='paren_open',
    PAREN_CLOSE ='paren_close',
    SEMI ='semi',
    PLUS ='plus',
    MINUS ='minus',
    STAR ='star',
    SLASH = 'slash',
    EQUAL = 'equal',

    // keywords
    TRUE = 'true',
    FALSE = 'false',
    LET = 'let',

    // --
    EOF = '<EOF>'
}

export const KeywordTypes = [
    TokenKind.TRUE,
    TokenKind.FALSE,
    TokenKind.LET,
] as const

export type KeywordType = typeof KeywordTypes[number]

export type NumberToken = TokenOf<TokenKind.NUMBER>
export type StringToken = TokenOf<TokenKind.STRING>
export type IdentifierToken = TokenOf<TokenKind.IDENTIFIER>
export type TrueToken = TokenOf<TokenKind.TRUE>
export type FalseToken = TokenOf<TokenKind.FALSE>

export type LiteralToken =
    | NumberToken
    | StringToken
    | IdentifierToken
    | TrueToken
    | FalseToken

export type OperatorToken =
    | TokenOf<TokenKind.PLUS>
    | TokenOf<TokenKind.MINUS>
    | TokenOf<TokenKind.STAR>
    | TokenOf<TokenKind.SLASH>
    | TokenOf<TokenKind.EQUAL>

export type VariableToken =
    IdentifierToken

export type Position = {
    line: number;
    col: number;
}

export type Range = {
    start: Position;
    end: Position;
};

export type LineInfo = {
    lineInfo: Range;
};

export type Token = (
    | Kinded<TokenKind.NUMBER,     { value: number; raw: string }>
    | Kinded<TokenKind.STRING,     { value: string; raw: string }>
    | Kinded<TokenKind.IDENTIFIER, { value: string; }>
    | Kinded<TokenKind.TRUE,       { value: string; }>
    | Kinded<TokenKind.FALSE,      { value: string; }>
    | Kinded<TokenKind.PAREN_OPEN>
    | Kinded<TokenKind.PAREN_CLOSE>
    | Kinded<TokenKind.SEMI>
    | Kinded<TokenKind.PLUS>
    | Kinded<TokenKind.MINUS>
    | Kinded<TokenKind.STAR>
    | Kinded<TokenKind.SLASH>
    | Kinded<TokenKind.EQUAL>
    | Kinded<TokenKind.LET>
    | Kinded<TokenKind.EOF>
) & LineInfo

export type Kinded<T, R = {}> = { kind:T } & R

export type TokenOf<T extends TokenKind> = Extract<Token, { kind: T }>

export interface Lexer<T> {
    lex(): T
    reader: Reader
}
