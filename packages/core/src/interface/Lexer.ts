import * as Ast from "../Ast";
import { UNREACHABLE } from "../lib/utils";
import type { Reader } from "./Reader";

export class LexerError {
    constructor(
        public message: string,
        public token?: Token,
    ) { }
}

export enum TokenKind {
    // literals
    STRING = 'string',
    NUMBER = 'number',
    IDENTIFIER = 'identifier',

    // single character tokens
    LEFT_PAREN = 'left_paren',
    RIGHT_PAREN = 'right_paren',
    LEFT_BRACE = 'left_brace',
    RIGHT_BRACE = 'right_brace',
    SEMI = 'semi',
    PLUS = 'plus',
    MINUS = 'minus',
    STAR = 'star',
    SLASH = 'slash',
    EQUAL = 'equal',
    COMMA = "comma",
    ARROW = "arrow",

    // keywords
    TRUE = 'true',
    FALSE = 'false',
    LET = 'let',
    FUNC = 'func',
    CASE = 'case',
    RETURN = 'return',
    CLASS = 'class',
    TYPE = 'type',
    IF = 'if',
    ELSE = 'else',

    // --
    EOF = '<EOF>',
}

const keywordTypeMap = {
    'true': TokenKind.TRUE,
    'false': TokenKind.FALSE,
    'let': TokenKind.LET,
    'func': TokenKind.FUNC,
    'case': TokenKind.CASE,
    'class': TokenKind.CLASS,
    'type': TokenKind.TYPE,
    'if': TokenKind.IF,
    'else': TokenKind.ELSE,
    'return': TokenKind.RETURN,
} as const;

export const KeywordTypes = Object.values(keywordTypeMap)

export type KeywordType = typeof KeywordTypes[number]

export type NumberToken = TokenOf<TokenKind.NUMBER>
export type StringToken = TokenOf<TokenKind.STRING>
export type IdentifierToken = TokenOf<TokenKind.IDENTIFIER>
export type TrueToken = TokenOf<TokenKind.TRUE>
export type FalseToken = TokenOf<TokenKind.FALSE>
export type CaseToken = TokenOf<TokenKind.CASE>
export type ArrowToken = TokenOf<TokenKind.ARROW>
export type ClassToken = TokenOf<TokenKind.CLASS>
export type TypeToken = TokenOf<TokenKind.TYPE>
export type IfToken = TokenOf<TokenKind.IF>
export type ElseToken = TokenOf<TokenKind.ELSE>

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
    | Kinded<TokenKind.LEFT_PAREN>
    | Kinded<TokenKind.RIGHT_PAREN>
    | Kinded<TokenKind.LEFT_BRACE>
    | Kinded<TokenKind.RIGHT_BRACE>
    | Kinded<TokenKind.SEMI>
    | Kinded<TokenKind.PLUS>
    | Kinded<TokenKind.MINUS>
    | Kinded<TokenKind.STAR>
    | Kinded<TokenKind.SLASH>
    | Kinded<TokenKind.EQUAL>
    | Kinded<TokenKind.COMMA>
    | Kinded<TokenKind.CLASS>
    | Kinded<TokenKind.FUNC>
    | Kinded<TokenKind.CASE>
    | Kinded<TokenKind.TYPE>
    | Kinded<TokenKind.ARROW>
    | Kinded<TokenKind.LET>
    | Kinded<TokenKind.IF>
    | Kinded<TokenKind.ELSE>
    | Kinded<TokenKind.RETURN>
    | Kinded<TokenKind.EOF>
) & LineInfo

export type ObjOf<T> = { [key: string]: T | undefined }

export type Kinded<T, R = {}> = { kind:T } & R

export type TokenOf<T extends TokenKind> = Extract<Token, { kind: T }>

export interface Lexer<T> {
    lex(): T
    reader: Reader
}

const newWithLineInfo = <T extends Token>(expr: T, r: Range) =>
    Object.assign(expr, { lineInfo: r })

export function getKeywordType(op: string) {
    return keywordTypeMap[op as KeywordType]
}

export function createToken<K extends TokenKind>(kind: K): TokenOf<K> {
    return {
        kind,
        lineInfo: {
            start: {
                col: 0,
                line: 0
            },
            end: {
                col: 0,
                line: 0
            },
        }
    } as any
}

export function getToken(expr: Ast.AstNode): Token {
    if (expr instanceof Ast.LiteralExpr) {
        return expr.token
    }

    if (expr instanceof Ast.BinaryExpr) {
        return newWithLineInfo(expr.op, {
            start: getToken(expr.left).lineInfo.start,
            end: getToken(expr.right).lineInfo.end,
        })
    }

    if (expr instanceof Ast.VariableExpr) {
        return expr.token
    }

    if (expr instanceof Ast.AssignExpr) {
        return expr.name
    }

    if (expr instanceof Ast.GroupingExpr) {
        return expr.token
    }

    if (expr instanceof Ast.LetDeclaration) {
        return expr.name
    }

    if (expr instanceof Ast.ExpressionStmt) {
        return expr.token
    }

    if (expr instanceof Ast.CallExpr) {
        return expr.paren
    }

    if (expr instanceof Ast.FuncDeclaration) {
        return expr.name
    }

    if (expr instanceof Ast.ReturnStmt) {
        return expr.keyword
    }

    if (expr instanceof Ast.CaseExpr) {
        return expr.token
    }

    if (expr instanceof Ast.IfExprStmt) {
        return expr.token
    }

    if (expr instanceof Ast.BlockStmt) {
        return getToken(expr.stmts[0])
    }

    if (expr instanceof Ast.ClassDeclaration) {
        return getToken(expr.methods[0])
    }

    throw new Error('No token found for: ' + UNREACHABLE(expr))
}

export function lineInfo(expr: Ast.Statement | Ast.Expression): Range {
    return getToken(expr).lineInfo
}
