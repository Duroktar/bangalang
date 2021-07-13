import type * as Ast from "../Ast";
import { TokenKind, VariableToken } from "../Lexer";
import type { Reader } from "../Reader";
import { BangaCallable, Environment, RuntimeError } from "../Runtime";
import type { Visitable, Visitor } from "../Visitor";
import { format, is } from "./utils";

export class AstInterpreter implements Visitor {
    public globals: Map<string, any> = new Map()
    public env: Map<string, any> = this.globals;

    constructor(private reader: Reader, env: Environment) {
        Object.entries(env)
            .map(([key, func]) => this.globals.set(key, func))
    }

    visitFuncDeclaration(node: Ast.FuncDeclaration) {
        throw new Error("Method not implemented.");
    }

    visitBlockStmt(node: Ast.BlockStmt) {
        throw new Error("Method not implemented.");
    }

    public execute(instructions: Ast.Program): any {
        const rv: any[] = []
        for (const line of instructions) {
            rv.push(this.evaluate(line))
        }
        return rv
    }

    visitExpressionStmt(node: Ast.ExpressionStmt) {
        return this.evaluate(node.expr)
    }

    visitLetDeclaration(node: Ast.LetDeclaration) {
        const token = <VariableToken>node.name
        const value = node.init
            ? this.evaluate(node.init)
            : undefined
        this.env.set(token.value, value)
    }

    visitVariableExpr(node: Ast.VariableExpr) {
        return this.env.get(node.name)
    }

    visitAssignExpr(node: Ast.AssignExpr) {
        const token = <VariableToken>node.name
        const value = this.evaluate(node.value)
        this.env.set(token.value, value)
    }

    visitGroupingExpr(node: Ast.GroupingExpr) {
        return this.evaluate(node.expr)
    }

    visitLiteralExpr(node: Ast.LiteralExpr) {
        return node.token.value
    }

    visitCallExpr(node: Ast.CallExpr): any {
        const callee = this.evaluate(node.callee);
        const args: Ast.Expression[] = [];
        for (let arg of node.args) {
            args.push(this.evaluate(arg))
        }
        if (!(is<BangaCallable>(callee))) {
            throw new RuntimeError(node.paren, "Expected ");
        }
        if (!callee.checkArity(args.length)) {
            const msg = "Expected {0} arguments but got {1}.";
            const err = format(msg, callee.arity(), args.length);
            throw new RuntimeError(node.paren, err);
        }
        return callee.call(this, args);
    }

    visitBinaryExpr(node: Ast.BinaryExpr) {
        const left = this.evaluate(node.left)
        const right = this.evaluate(node.right)
        switch (node.op.kind) {
            case TokenKind.PLUS:
                return <any>left + <any>right
            case TokenKind.MINUS:
                return <any>left - <any>right
        }
    }

    private evaluate<T extends Visitable>(node: T): T {
        return node.accept(this)
    }
}
