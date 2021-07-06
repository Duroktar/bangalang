import type * as Ast from "../Ast";
import { TokenKind, VariableToken } from "../Lexer";
import type { Reader } from "../Reader";
import type { Visitable, Visitor } from "../Visitor";

export class AstInterpreter implements Visitor {
    public env: Map<string, any> = new Map()

    constructor(private reader: Reader) {}

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
