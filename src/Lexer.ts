import type { Reader } from "./Reader";

export class LexerError extends Error {}

export enum TokenType {
    STRING = 1,
    NUMBER,
    IDENTIFIER,

    PAREN_OPEN,
    PAREN_CLOSE,
    SEMI,
    PLUS,
    MINUS,
    STAR,
    SLASH,
    EQUAL,

    EOF
}

export const OperatorTypes = [
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.STAR,
    TokenType.SLASH,
    TokenType.EQUAL,
] as const

export type OperatorType = typeof OperatorTypes[number]

export type LiteralToken =
    | TokenOf<TokenType.NUMBER>
    | TokenOf<TokenType.STRING>
    | TokenOf<TokenType.IDENTIFIER>

export type OperatorToken =
    | TokenOf<TokenType.PLUS>
    | TokenOf<TokenType.MINUS>
    | TokenOf<TokenType.STAR>
    | TokenOf<TokenType.SLASH>
    | TokenOf<TokenType.EQUAL>

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

export type Token =
    | { type: TokenType.NUMBER; raw: string; value: number; } & LineInfo
    | { type: TokenType.STRING; raw: string; value: string; } & LineInfo
    | { type: TokenType.SEMI;   raw: string; } & LineInfo
    | { type: TokenType.PLUS;   raw: string; } & LineInfo
    | { type: TokenType.MINUS;  raw: string; } & LineInfo
    | { type: TokenType.STAR;   raw: string; } & LineInfo
    | { type: TokenType.SLASH;  raw: string; } & LineInfo
    | { type: TokenType.EQUAL;  raw: string; } & LineInfo
    | { type: TokenType.IDENTIFIER;  raw: string; value: string; } & LineInfo
    | { type: TokenType.PAREN_OPEN;  raw: string; } & LineInfo
    | { type: TokenType.PAREN_CLOSE; raw: string; } & LineInfo
    | { type: TokenType.EOF; }

export type TokenOf<T> = Extract<Token, { type: T }>

export interface Lexer<T> {
    lex(): T
    reader: Reader
}
