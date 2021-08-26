import type { LiteralToken, OperatorToken, Token, TokenOf, VariableToken } from "./interface/Lexer";
import { TokenKind } from "./interface/Lexer";
import type { Visitable, Visitor } from "./interface/Visitor";
import { UNREACHABLE } from "./lib/utils";

export type Program =
    | AstNode[]

export type AstNode =
    | Declaration

export type Declaration =
    | ClassDeclaration
    | FuncDeclaration
    | LetDeclaration
    | Statement

export type Statement =
    | ExpressionStmt
    | ReturnStmt
    | BlockStmt
    | Expression

export type Expression =
    | AssignExpr
    | BinaryExpr
    | CallExpr
    | CaseExpr
    | IfExprStmt
    | LiteralExpr
    | VariableExpr
    | GroupingExpr

export type CaseMatcher =
    | LiteralExpr
    | VariableExpr
    | GroupingExpr

export type CaseExprCase = {
    matcher: CaseMatcher
    ifMatch: Expression
};

export class ClassDeclaration implements Visitable {
    public kind = 'ClassDeclaration' as const
    constructor(
        public name: VariableToken,
        public methods: FuncDeclaration[],
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitClassDeclaration(this);
    };

    toString(): string {
        const name = this.name.value;
        // const params = this.methods
        //     .map(o => o.value)
        //     .join(', ');
        // const body = this.body.toString();
        return `class ${name} { TODO }`;
    }

    static is = (other: AstNode): other is ClassDeclaration => (other.kind === 'ClassDeclaration')
}

export class FuncDeclaration implements Visitable {
    public kind = 'FuncDeclaration' as const
    constructor(
        public name: VariableToken,
        public params: VariableToken[],
        public body: BlockStmt,
        public func: TokenOf<TokenKind.FUNC>,
        public varargs: boolean = false,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitFuncDeclaration(this);
    };

    toString(): string {
        const name = this.name.value;
        const params = this.params
            .map(o => o.value)
            .join(', ');
        const body = this.body.toString();
        return `func ${name}(${params}) ${body}`;
    }

    static is = (other: AstNode): other is FuncDeclaration => (other.kind === 'FuncDeclaration')
}

export class LetDeclaration implements Visitable {
    public kind = 'LetDeclaration' as const
    constructor(
        public name: VariableToken,
        public init: Expression,
        public token: TokenOf<TokenKind.LET>,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitLetDeclaration(this);
    };

    toString(): string {
        const name = this.name.value;
        const init = this.init.toString();
        return `let ${name} = ${init}`
    }

    static is = (other: AstNode): other is LetDeclaration => (other.kind === 'LetDeclaration')
}

export class ExpressionStmt implements Visitable {
    public kind = 'ExpressionStmt' as const
    constructor(
        public expr: Expression,
        public token: Token,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitExpressionStmt(this);
    };

    toString(): string {
        return this.expr.toString()
    }

    static is = (other: AstNode): other is ExpressionStmt => (other.kind === 'ExpressionStmt')
}

export class AssignExpr implements Visitable {
    public kind = 'AssignExpr' as const
    constructor(
        public name: VariableToken,
        public value: Expression,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitAssignExpr(this);
    };

    toString(): string {
        const name = this.name.value;
        const value = this.value.toString();
        return `${name} = ${value}`
    }

    static is = (other: AstNode): other is AssignExpr => (other.kind === 'AssignExpr')
}

export class BinaryExpr implements Visitable {
    public kind = 'BinaryExpr' as const
    constructor(
        public left: Expression,
        public op: OperatorToken,
        public right: Expression,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitBinaryExpr(this);
    };

    toString(): string {
        const op = opKindToString(this.op.kind);
        const left = this.left.toString();
        const right = this.right.toString();
        return `${left} ${op} ${right}`
    }

    static is = (other: AstNode): other is BinaryExpr => (other.kind === 'BinaryExpr')
}

export class CallExpr implements Visitable {
    public kind = 'CallExpr' as const
    constructor(
        public callee: Expression,
        public paren: TokenOf<TokenKind.RIGHT_PAREN>,
        public args: Expression[],
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitCallExpr(this);
    };

    toString(): string {
        const callee = this.callee.toString();
        const args = this.args.map(o => o.toString());
        return `${callee}(${args.join(', ')});`;
    }

    static is = (other: AstNode): other is CallExpr => (other.kind === 'CallExpr')
}

export class LiteralExpr implements Visitable {
    public kind = 'LiteralExpr' as const
    constructor(
        public value: unknown,
        public raw: string,
        public token: LiteralToken,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitLiteralExpr(this);
    };

    toString(): string { return String(this.value) }

    static is = (other: AstNode): other is LiteralExpr => (other.kind === 'LiteralExpr')
}

export class VariableExpr implements Visitable {
    public kind = 'VariableExpr' as const
    constructor(
        public name: string,
        public token: VariableToken,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitVariableExpr(this);
    };

    toString(): string { return this.name }

    isUnderscore(): boolean { return this.name === '_' }

    static is = (other: AstNode): other is VariableExpr => (other.kind === 'VariableExpr')
}

export class GroupingExpr implements Visitable {
    public kind = 'GroupingExpr' as const
    constructor(
        public expr: Expression,
        public token: Token,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitGroupingExpr(this);
    };

    toString(): string {
        return `(${this.expr.toString()})`
    }

    static is = (other: AstNode): other is GroupingExpr => (other.kind === 'GroupingExpr')
}

export class IfExprStmt implements Visitable {
    public kind = 'IfExprStmt' as const
    constructor(
        public cond: Expression,
        public pass: BlockStmt,
        public fail: BlockStmt | null = null,
        public token: Token,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitIfExprStmt(this);
    };

    toString(): string {
        return `if (TODO)`
    }

    static is = (other: AstNode): other is IfExprStmt => (other.kind === 'IfExprStmt')
}

export class CaseExpr implements Visitable {
    public kind = 'CaseExpr' as const
    constructor(
        public expr: Expression,
        public cases: CaseExprCase[],
        public token: Token,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitCaseExpr(this);
    };

    toString(): string {
        return `case`
    }

    static is = (other: AstNode): other is CaseExpr => (other.kind === 'CaseExpr')
}

export class BlockStmt implements Visitable {
    public kind = 'BlockStmt' as const
    constructor(
        public stmts: Statement[],
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitBlockStmt(this);
    };

    toString(): string {
        const stmts = this.stmts
            .map(o => '  ' + o)
            .join('\n');
        return `{\n${stmts}\n}`
    }

    static is = (other: AstNode): other is BlockStmt => (other.kind === 'BlockStmt')
}

export class ReturnStmt implements Visitable {
    public kind = 'ReturnStmt' as const
    constructor(
        public keyword: TokenOf<TokenKind.RETURN>,
        public value: Expression,
    ) { }

    acceptVisitor = (visitor: Visitor) => {
        return visitor.visitReturnStmt(this);
    };

    toString(): string {
        return `return ${this.value.toString()}`
    }

    static is = (other: AstNode): other is ReturnStmt => (other.kind === 'ReturnStmt')
}

export function kindName(kind: Expression['kind']): string {
    switch (kind) {
        case 'AssignExpr': return 'variable';
        case 'BinaryExpr': return 'binary';
        case 'GroupingExpr': return 'group';
        case 'LiteralExpr': return 'literal';
        case 'VariableExpr': return 'variable';
        case 'CallExpr': return 'call';
        case 'CaseExpr': return 'case';
        case 'IfExprStmt': return 'if';
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
