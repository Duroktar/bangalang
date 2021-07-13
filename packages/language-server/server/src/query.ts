import { AssignExpr, AstNode, BinaryExpr, BlockStmt, CallExpr, Expression, ExpressionStmt, FuncDeclaration, GroupingExpr, LetDeclaration, LiteralExpr, Program, ReturnStmt, Statement, Token, TokenKind, Typed, VariableExpr, Visitor } from '@bangalang/core';

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
    visitFuncDeclaration(node: FuncDeclaration): any {
        if (node.name === this.target) {
            return node;
        }
        for (const param of node.params) {
            if (param === this.target) {
                return param;
            }
        }
        return node.body.accept(this);
    }
    visitBlockStmt(node: BlockStmt): any {
        for (const stmt of node.stmts) {
            const res: AstNode = stmt.accept(this);
            if (res) { return res; }
        }
        return null;
    }
    visitReturnStmt(node: ReturnStmt): any{
        if (node.keyword === this.target) {
            return node;
        }
        return node.value.accept(this);
    }
}

class QuerySelectorAllVisitor implements Visitor {
    constructor(
        public selectors: string[],
    ) {
        this._selectors = selectors
            .map(s => s.trim().replace(/^(\.){1}/, ''));
    }

    query(source: QueryData): (AstNode | Token)[] {
        const program = Array.isArray(source) ? source : [source];
        for (const stmt of program) {
            stmt?.accept(this);
        }
        return this._selected;
    }

    visitExpressionStmt(node: ExpressionStmt): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.expr.accept(this);
    }
    visitLetDeclaration(node: LetDeclaration): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.init.accept(this);
    }
    visitGroupingExpr(node: GroupingExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.expr.accept(this);
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
        node.value.accept(this);
    }
    visitBinaryExpr(node: BinaryExpr): any {
        if (this._selectors.includes(node.op.kind))
            this._selected.push(node);
        node.left.accept(this);
        node.right.accept(this);
    }
    visitReturnStmt(node: ReturnStmt): any {
        if (this._selectors.includes(node.keyword.kind))
            this._selected.push(node);
        node.value.accept(this);
    }
    visitCallExpr(node: CallExpr): any{
        if (this._selectors.includes(node.paren.kind)) {
            this._selected.push(node);
        }
        node.args.forEach(arg =>arg.accept(this));
        node.callee.accept(this);
    }
    visitFuncDeclaration(node: FuncDeclaration): any {
        if (this._selectors.includes(node.name.kind)) {
            this._selected.push(node);
        }
        node.params.forEach(param => {
            if (this._selectors.includes(param.kind)) {
                this._selected.push(param);
            }
        });
        node.body.accept(this);
    }
    visitBlockStmt(node: BlockStmt): any {
        node.stmts.forEach(stmt => {
            if (this._selectors.includes(stmt.kind)) {
                this._selected.push(stmt);
            }
        });
    }

    private _selectors: string[];
    private _selected: (AstNode | Token)[] = [];
}

export function findNodeForToken(program: QueryData, token: Token) {
    const visitor = new QueryVisitor(token);
    return visitor.query(program);
}

export function querySelectorAll(program: QueryData, selectors: `.${TokenKind}`[]) {
    const visitor = new QuerySelectorAllVisitor(selectors);
    return visitor.query(program);
}
