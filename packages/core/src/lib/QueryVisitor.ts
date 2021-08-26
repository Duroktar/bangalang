import * as Ast from "../Ast";
import { Token, TokenKind } from "../interface/Lexer";
import { Visitor } from "../interface/Visitor";
import { Typed } from "../interface/TypeCheck";
import { findTokenAtLocation } from "./utils";

type QueryData = Ast.Program | Ast.Statement | Ast.Expression;

class QueryVisitor implements Visitor {
    constructor(public target: Token) {}

    query(source: QueryData): Typed<Ast.Statement> | null {
        const program = Array.isArray(source) ? source : [source];
        for (const stmt of program) {
            const res = stmt?.acceptVisitor(this);
            if (res !== null) return res;
        }
        return null;
    }

    visitExpressionStmt(node: Ast.ExpressionStmt): any {
        if (node.token === this.target) {
            return node;
        }
        return node.expr?.acceptVisitor(this);
    }
    visitLetDeclaration(node: Ast.LetDeclaration): any {
        if (node.token === this.target) {
            return node;
        }
        if (node.name === this.target) {
            return node;
        }
        return node.init?.acceptVisitor(this);
    }
    visitGroupingExpr(node: Ast.GroupingExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return node.expr?.acceptVisitor(this);
    }
    visitLiteralExpr(node: Ast.LiteralExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return null;
    }
    visitIfExprStmt(node: Ast.IfExprStmt): any {
        if (node.token === this.target) {
            return node;
        }
        return (
               node.cond.acceptVisitor(this)
            ?? node.pass.acceptVisitor(this)
            ?? node.fail?.acceptVisitor(this)
        );
    }
    visitVariableExpr(node: Ast.VariableExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return null;
    }
    visitAssignExpr(node: Ast.AssignExpr): any {
        if (node.name === this.target) {
            return node;
        }
        return node.value?.acceptVisitor(this);
    }
    visitBinaryExpr(node: Ast.BinaryExpr): any {
        if (node.op === this.target) {
            return node;
        }
        const left = node.left?.acceptVisitor(this);
        const right = node.right?.acceptVisitor(this);
        return left ?? right;
    }
    visitCallExpr(node: Ast.CallExpr): any {
        for (const arg of node.args) {
            const maybeArg = arg.acceptVisitor(this);
            if (maybeArg) return maybeArg;
        }
        if (node.paren === this.target) {
            return node;
        }
        return node.callee?.acceptVisitor(this);
    }
    visitFuncDeclaration(node: Ast.FuncDeclaration): any {
        if (node.name === this.target) {
            return node;
        }
        if (node.func === this.target) {
            return node;
        }
        for (const param of node.params) {
            if (param === this.target) {
                return param;
            }
        }
        return node.body.acceptVisitor(this);
    }
    visitClassDeclaration(node: Ast.ClassDeclaration): any {
        if (node.name === this.target) {
            return node;
        }
        for (const method of node.methods) {
            const maybeMethod = method.acceptVisitor(this);
            if (maybeMethod) return maybeMethod;
        }
    }
    visitBlockStmt(node: Ast.BlockStmt): any {
        for (const stmt of node.stmts) {
            const res: Ast.AstNode = stmt.acceptVisitor(this);
            if (res) {
                return res;
            }
        }
        return null;
    }
    visitReturnStmt(node: Ast.ReturnStmt): any {
        if (node.keyword === this.target) {
            return node;
        }
        return node.value.acceptVisitor(this);
    }
    visitCaseExpr(node: Ast.CaseExpr): any {
        if (node.token === this.target) {
            return node;
        }
        for (const param of node.cases) {
            const ifMatch = param.ifMatch.acceptVisitor(this);
            if (ifMatch) {
                return ifMatch;
            }
            const matcher = param.matcher.acceptVisitor(this);
            if (matcher) {
                return matcher;
            }
        }
        return node.expr.acceptVisitor(this);
    }
}

class QuerySelectorAllVisitor implements Visitor {
    constructor(public selectors: string[]) {
        this._selectors = selectors.map((s) =>
            s.trim().replace(/^(\.){1}/, "")
        );
    }

    query(source: QueryData): (Ast.AstNode | Token)[] {
        const program = Array.isArray(source) ? source : [source];
        for (const stmt of program) {
            stmt?.acceptVisitor(this);
        }
        return this._selected;
    }

    visitExpressionStmt(node: Ast.ExpressionStmt): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.expr.acceptVisitor(this);
    }
    visitLetDeclaration(node: Ast.LetDeclaration): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.init.acceptVisitor(this);
    }
    visitGroupingExpr(node: Ast.GroupingExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
        node.expr.acceptVisitor(this);
    }
    visitLiteralExpr(node: Ast.LiteralExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
    }
    visitIfExprStmt(node: Ast.IfExprStmt) {
        if (this._selectors.includes(node.token.kind)) {
            this._selected.push(node);
        }
        node.cond.acceptVisitor(this);
        node.pass.acceptVisitor(this);
        node.fail?.acceptVisitor(this);
    }
    visitVariableExpr(node: Ast.VariableExpr): any {
        if (this._selectors.includes(node.token.kind))
            this._selected.push(node);
    }
    visitAssignExpr(node: Ast.AssignExpr): any {
        if (this._selectors.includes(node.name.kind)) this._selected.push(node);
        node.value.acceptVisitor(this);
    }
    visitBinaryExpr(node: Ast.BinaryExpr): any {
        if (this._selectors.includes(node.op.kind)) this._selected.push(node);
        node.left.acceptVisitor(this);
        node.right.acceptVisitor(this);
    }
    visitReturnStmt(node: Ast.ReturnStmt): any {
        if (this._selectors.includes(node.keyword.kind))
            this._selected.push(node);
        node.value.acceptVisitor(this);
    }
    visitCallExpr(node: Ast.CallExpr): any {
        if (this._selectors.includes(node.paren.kind)) {
            this._selected.push(node);
        }
        node.args.forEach((arg) => arg.acceptVisitor(this));
        node.callee.acceptVisitor(this);
    }
    visitClassDeclaration(node: Ast.ClassDeclaration): any {
        if (this._selectors.includes(node.name.kind)) {
            this._selected.push(node);
        }
        node.methods.forEach((method) => {
            if (this._selectors.includes(method.kind)) {
                this._selected.push(method);
            }
        });
    }
    visitFuncDeclaration(node: Ast.FuncDeclaration): any {
        if (this._selectors.includes(node.name.kind)) {
            this._selected.push(node);
        }
        node.params.forEach((param) => {
            if (this._selectors.includes(param.kind)) {
                this._selected.push(param);
            }
        });
        node.body.acceptVisitor(this);
    }
    visitBlockStmt(node: Ast.BlockStmt): any {
        node.stmts.forEach((stmt) => {
            if (this._selectors.includes(stmt.kind)) {
                this._selected.push(stmt);
            }
        });
    }
    visitCaseExpr(node: Ast.CaseExpr) {
        if (this._selectors.includes(node.expr.kind)) {
            this._selected.push(node.expr);
        }
        node.cases.forEach((stmt) => {
            if (this._selectors.includes(stmt.ifMatch.kind)) {
                this._selected.push(stmt.ifMatch);
            }
            if (this._selectors.includes(stmt.matcher.kind)) {
                this._selected.push(stmt.matcher);
            }
        });
    }

    private _selectors: string[];
    private _selected: (Ast.AstNode | Token)[] = [];
}

export function getFirstNodeAtLine(sourceData: { tokens: Token[], ast: QueryData }, line: number): Ast.AstNode | null {
    const token = sourceData.tokens.find(o => o.lineInfo.start.line === line)
    if (token === undefined) { return null; }
    return findNodeForToken(sourceData.ast, token);
}

export function findNodeAtLocation(sourceData: { tokens: Token[], ast: QueryData }, line: number, char: number): Ast.AstNode | null {
    const token = findTokenAtLocation(sourceData, line, char);
    if (token === null) { return null; }
    return findNodeForToken(sourceData.ast, token);
}

export function findNodeForToken(program: QueryData, token: Token) {
    const visitor = new QueryVisitor(token);
    return visitor.query(program);
}

export function querySelectorAll(
    program: QueryData,
    selectors: `.${TokenKind}`[]
) {
    const visitor = new QuerySelectorAllVisitor(selectors);
    return visitor.query(program);
}
