import { AssignExpr, AstNode, BinaryExpr, CallExpr, Expression, ExpressionStmt, GroupingExpr, LetDeclaration, LiteralExpr, Program, Statement, Token, TokenKind, Typed, VariableExpr, Visitor } from '@bangalang/core';

type QueryData = Program | Statement | Expression;

class QueryVisitor implements Visitor {
    constructor(public target: Token) { }

    query(source: QueryData): Typed<Statement> | null {
        const program = Array.isArray(source) ? source : [source];
        for (const stmt of program) {
            const res = stmt?.accept(this);
            if (res !== null) return res;
        }
        return null;
    }

    visitExpressionStmt(node: ExpressionStmt): any {
        if (node.token === this.target) {
            return node;
        }
        return node.expr?.accept(this);
    }
    visitLetDeclaration(node: LetDeclaration): any {
        if (node.name === this.target) {
            return node;
        }
        return node.init?.accept(this);
    }
    visitGroupingExpr(node: GroupingExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return node.expr?.accept(this);
    }
    visitLiteralExpr(node: LiteralExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return null;
    }
    visitVariableExpr(node: VariableExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return null;
    }
    visitAssignExpr(node: AssignExpr): any {
        if (node.name === this.target) {
            return node;
        }
        return node.value?.accept(this);
    }
    visitBinaryExpr(node: BinaryExpr): any {
        if (node.op === this.target) {
            return node;
        }
        const left = node.left?.accept(this);
        const right = node.right?.accept(this);
        return left ?? right;
    }
    visitCallExpr(node: CallExpr): any{
        if (node.paren === this.target) {
            return node;
        }
        return node.callee?.accept(this);
    }
}

class QuerySelectorAllVisitor implements Visitor {
    constructor(
        public selectors: string[],
    ) {
        this._selectors = selectors
            .map(s => s.trim().replace(/^(\.){1}/, ''));
    }

    query(source: QueryData): (AstNode)[] {
        const program = Array.isArray(source) ? source : [source];
        for (const stmt of program) {
            stmt?.accept(this);
        }
        return this._selected;
    }

    visitExpressionStmt(node: ExpressionStmt): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.expr?.accept(this);
    }
    visitLetDeclaration(node: LetDeclaration): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.init?.accept(this);
    }
    visitGroupingExpr(node: GroupingExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.expr?.accept(this);
    }
    visitLiteralExpr(node: LiteralExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
    }
    visitVariableExpr(node: VariableExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
    }
    visitAssignExpr(node: AssignExpr): any {
        if (this._selectors.includes(node.name.kind))
            this._selected.push(node);
        node.value?.accept(this);
    }
    visitBinaryExpr(node: BinaryExpr): any {
        if (this._selectors.includes(node.op.kind))
            this._selected.push(node);
        node.left?.accept(this);
        node.right?.accept(this);
    }

    visitCallExpr(node: CallExpr): any{
        if (this._selectors.includes(node.paren.kind)) {
            this._selected.push(node);
        }
        node.args.forEach(arg =>arg.accept(this));
        node.callee?.accept(this);
    }

    private _selectors: string[];
    private _selected: AstNode[] = [];
}

export function findNodeForToken(program: QueryData, token: Token) {
    const visitor = new QueryVisitor(token);
    return visitor.query(program);
}

export function querySelectorAll(program: QueryData, selectors: `.${TokenKind}`[]) {
    const visitor = new QuerySelectorAllVisitor(selectors);
    return visitor.query(program);
}
