import * as Ast from "../Ast"
import { getToken, TokenKind, VariableToken } from "../Lexer"
import type { Reader } from "../Reader"
import { Reporter } from "../Reporter"
import { TypeChecker, TypeCheckError, WithType, TypeName } from "../Types"
import type { Visitable } from "../Visitor"
import { capitalize, UNREACHABLE } from "./utils"

export class AstTypeChecker implements TypeChecker {
    public errors: TypeCheckError[] = []
    public env: Map<string, TypeName> = new Map()

    constructor(public reader: Reader, public reporter: Reporter) {}

    visitFuncDeclaration(node: Ast.FuncDeclaration) {
        throw new Error("Method not implemented.");
    };

    visitReturnStmt(node: Ast.ReturnStmt) {
        throw new Error("Method not implemented.");
    };

    visitBlockStmt(node: Ast.BlockStmt) {
        throw new Error("Method not implemented.");
    };

    typecheck(declarations: Ast.Program) {
        const rv: WithType<Ast.AstNode>[] = []
        for (let decl of declarations) {
            rv.push(this.visit(decl))
        }
        return rv
    }

    visitLetDeclaration(node: Ast.LetDeclaration) {
        const init = this.visit(node.init)
        const initType = this.infer(init)
        const type = { type: initType }
        const name = <VariableToken>node.name
        this.env.set(name.value, type.type)
        Object.assign(name, type)
        return Object.assign(node, type)
    }

    visitExpressionStmt(node: Ast.ExpressionStmt) {
        const expr = this.visit(node.expr)
        const type = { type: this.infer(expr) }
        return Object.assign(node, type)
    }

    visitVariableExpr(node: Ast.VariableExpr) {
        const type = this.env.get(node.name)
        return Object.assign(node, { type })
    }

    visitAssignExpr(node: Ast.AssignExpr) {
        const nType = this.env.get((<VariableToken>node.name).value)
        const expr = this.visit(node.value)
        const type = { type: nType ?? TypeName.NEVER }
        const wType = Object.assign(node, type)
        return this.unify(wType, expr, (t1, t2) => {
            const k1 = capitalize(Ast.kindName(t2.kind))
            return (
                `${k1} of type '${t2.type}'` +
                `is not assignable to ${Ast.kindName(t1.kind)}` +
                `of type '${t1.type}'.`
            )
        })
    }

    visitGroupingExpr(node: Ast.GroupingExpr) {
        const expr = this.visit(node.expr)
        const type = { type: this.infer(expr) }
        return Object.assign(node, type)
    }

    visitLiteralExpr(node: Ast.LiteralExpr) {
        const type = { type: this.infer(node) }
        return Object.assign(node, type)
    }

    visitCallExpr(node: Ast.CallExpr) {
        const type = { type: this.infer(node) }
        return Object.assign(node, type)
    }

    visitBinaryExpr(node: Ast.BinaryExpr) {
        const left = this.visit(node.left)
        const right = this.visit(node.right)
        const type = { type: this.unify(left, right) }
        return Object.assign(node, type)
    }

    infer(expr: Ast.AstNode): TypeName {
        if (expr instanceof Ast.LiteralExpr) {
            switch (expr.token.kind) {
                case TokenKind.NUMBER:
                    return TypeName.NUMBER
                case TokenKind.STRING:
                    return TypeName.STRING
                case TokenKind.FALSE:
                case TokenKind.TRUE:
                    return TypeName.BOOLEAN
                case TokenKind.IDENTIFIER:
                    return TypeName.ANY
                default: {
                    UNREACHABLE(expr.token)
                    throw new Error('unreachable')
                }
            }
        }

        if (
            expr instanceof Ast.BinaryExpr     ||
            expr instanceof Ast.BlockStmt      ||
            expr instanceof Ast.AssignExpr     ||
            expr instanceof Ast.CallExpr       ||
            expr instanceof Ast.VariableExpr   ||
            expr instanceof Ast.GroupingExpr   ||
            expr instanceof Ast.LetDeclaration ||
            expr instanceof Ast.FuncDeclaration||
            expr instanceof Ast.ReturnStmt     ||
            expr instanceof Ast.ExpressionStmt
        ) {
            return (<WithType<typeof expr>>expr).type
        }

        return UNREACHABLE(expr) && TypeName.NEVER
    }

    unify<T1 extends WithType<Ast.Expression>, T2 extends WithType<Ast.Expression>>(
        expr1: T1, expr2: T2,
        getErrMsg?: (t1: T1, t2: T2) => string
    ): TypeName {
        if ([expr1.type, expr2.type].includes(TypeName.ANY)) {
            return [expr1.type, expr2.type]
                .filter(o => o !== TypeName.ANY)[0]
        }
        if (expr1.type !== expr2.type) {
            const errMsg = getErrMsg?.(expr1, expr2)
            const typeError = this.reporter.formatTypeError(this.reader, expr1, expr2, errMsg)
            this.errors.push(new TypeCheckError(typeError, getToken(expr1)))
            return TypeName.NEVER
        }
        return expr1.type;
    }

    visit<T extends Visitable>(node: T): WithType<T> {
        return node.accept(this)
    }
}
