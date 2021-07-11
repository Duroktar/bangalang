import type { LiteralToken, OperatorToken, Token, TokenOf, VariableToken } from "./Lexer";
import { TokenKind } from "./Lexer";
import type { Visitable, Visitor } from "./Visitor";
import { UNREACHABLE } from "./lib/utils";

export type Program =
    | AstNode[]

export type AstNode =
    | Declaration

export type Declaration =
    | LetDeclaration
    | Statement

export type Statement =
    | ExpressionStmt
    | Expression

export type Expression =
    | AssignExpr
    | BinaryExpr
    | CallExpr
    | LiteralExpr
    | VariableExpr
    | GroupingExpr

export class LetDeclaration implements Visitable {
    public kind = 'LetDeclaration' as const
    constructor(
        public name: VariableToken,
        public init: Expression,
        public token: TokenOf<TokenKind.LET>,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitLetDeclaration(this);
    };

    toString(): string { return this.name.value }
}

export class ExpressionStmt implements Visitable {
    public kind = 'ExpressionStmt' as const
    constructor(
        public expr: Expression,
        public token: Token,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitExpressionStmt(this);
    };

    toString(): string { return this.expr.toString() }
}

export class AssignExpr implements Visitable {
    public kind = 'AssignExpr' as const
    constructor(
        public name: VariableToken,
        public value: Expression,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitAssignExpr(this);
    };

    toString(): string { return this.name.value }
}

export class BinaryExpr implements Visitable {
    public kind = 'BinaryExpr' as const
    constructor(
        public left: Expression,
        public op: OperatorToken,
        public right: Expression,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitBinaryExpr(this);
    };

    toString(): string { return opKindToString(this.op.kind) }
}

export class CallExpr implements Visitable {
    public kind = 'CallExpr' as const
    constructor(
        public callee: Expression,
        public paren: TokenOf<TokenKind.PAREN_CLOSE>,
        public args: Expression[],
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitCallExpr(this);
    };

    toString(): string {
        const callee = this.callee.toString();
        const args = this.args.map(o => o.toString());
        return `${callee}(${args.join(', ')});`;
    }
}

export class LiteralExpr implements Visitable {
    public kind = 'LiteralExpr' as const
    constructor(
        public value: unknown,
        public raw: string,
        public token: LiteralToken,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitLiteralExpr(this);
    };

    toString(): string { return this.value + '' }
}

export class VariableExpr implements Visitable {
    public kind = 'VariableExpr' as const
    constructor(
        public name: string,
        public token: VariableToken,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitVariableExpr(this);
    };

    toString(): string { return this.name }
}

export class GroupingExpr implements Visitable {
    public kind = 'GroupingExpr' as const
    constructor(
        public expr: Expression,
        public token: Token,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitGroupingExpr(this);
    };

    toString(): string { return `( ${this.expr.toString()} )` }
}

export function kindName(kind: Expression['kind']): string {
    switch (kind) {
        case 'AssignExpr': return 'variable';
        case 'BinaryExpr': return 'binary';
        case 'GroupingExpr': return 'group';
        case 'LiteralExpr': return 'literal';
        case 'VariableExpr': return 'variable';
        case 'CallExpr': return 'call';
        default:
            return UNREACHABLE(kind)
    }
}

export function opKindToString(kind: OperatorToken['kind']): string {
    switch (kind) {
        case TokenKind.EQUAL: return '=';
        case TokenKind.PLUS: return '+';
        case TokenKind.MINUS: return '-';
        case TokenKind.STAR: return '*';
        case TokenKind.SLASH: return '/';
        default:
            return UNREACHABLE(kind)
    }
}
