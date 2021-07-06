import type { LiteralToken, OperatorToken, Token, VariableToken } from "./Lexer";
import type { Visitable, Visitor } from "./Visitor";
import { UNREACHABLE } from "./lib/utils";

export type Program =
    | Statement[]

export type Statement =
    | LetDeclaration
    | ExpressionStmt

export type Expression =
    | AssignExpr
    | BinaryExpr
    | LiteralExpr
    | VariableExpr
    | GroupingExpr

export class LetDeclaration implements Visitable {
    public kind = 'LetDeclaration' as const
    constructor(
        public name: VariableToken,
        public init: Expression,
    ) { }

    accept = (visitor: Visitor) => {
        return visitor.visitLetDeclaration(this);
    };
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
}

export function kindName(kind: Expression['kind']): string {
    switch (kind) {
        case 'AssignExpr': return 'variable';
        case 'BinaryExpr': return 'binary expression';
        case 'GroupingExpr': return 'group';
        case 'LiteralExpr': return 'literal';
        case 'VariableExpr': return 'variable';
        default:
            return UNREACHABLE(kind)
    }
}
