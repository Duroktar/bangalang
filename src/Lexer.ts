import type { Reader } from "./Reader";

export class LexerError extends Error {}

export enum TokenType {
    STRING = 1,
    NUMBER,
    PLUS,
    PAREN_OPEN,
    PAREN_CLOSE,
    SEMI,
}

export type OperatorType =
    | TokenType.PLUS

export type LiteralToken =
    | Extract<Token, { type: TokenType.NUMBER }>
    | Extract<Token, { type: TokenType.STRING }>

export type OperatorToken =
    | Extract<Token, { type: TokenType.PLUS }>

export type Token =
    | { type: TokenType.NUMBER; raw: string; value: number; }
    | { type: TokenType.STRING; raw: string; value: string; }
    | { type: TokenType.PLUS; raw: string; }
    | { type: TokenType.PAREN_OPEN; raw: string; }
    | { type: TokenType.PAREN_CLOSE; raw: string; }
    | { type: TokenType.SEMI; raw: string; }

export interface Lexer<T> {
    lex(): T
    reader: Reader
}
