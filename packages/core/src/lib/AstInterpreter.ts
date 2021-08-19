import type * as Ast from "../Ast";
import { Interpreter } from "../interface/Interpreter";
import { TokenKind, VariableToken } from "../interface/Lexer";
import type { Reader } from "../interface/Reader";
import type { Visitable } from "../interface/Visitor";
import { BangaCallable, Environment, ReturnValue, RuntimeError } from "../interface/Runtime";
import { format, is } from "./utils";
import { BangaFunction, createEnvironment } from "./RuntimeLibrary";

export class AstInterpreter implements Interpreter {
    public globals: Environment = new Map()
    public environment: Environment = this.globals;

    constructor(private reader: Reader, env: Environment) {
        [...env.entries()]
            .map(([key, func]) => this.environment.set(key, func))
    }

    visitClassDeclaration(node: Ast.ClassDeclaration) {
        throw new Error("Method not implemented (visitClassDeclaration).");
    }

    public execute(instructions: Ast.Program): any {
        const rv: any[] = []
        for (const line of instructions) {
            rv.push(this.evaluate(line))
        }
        return rv
    }

    public executeBlock(statement: Ast.Declaration[], environment: Environment) {
        const previous = this.environment;
        try {
            this.environment = createEnvironment(environment);
            this.execute(statement);
        } finally {
            this.environment = previous;
        }
    }

    visitExpressionStmt(node: Ast.ExpressionStmt) {
        return this.evaluate(node.expr)
    }

    visitLetDeclaration(node: Ast.LetDeclaration) {
        const token = <VariableToken>node.name
        const value = node.init
            ? this.evaluate(node.init)
            : undefined
        this.environment.set(token.value, value)
    }

    visitVariableExpr(node: Ast.VariableExpr) {
        return this.environment.get(node.name)
    }

    visitAssignExpr(node: Ast.AssignExpr) {
        const token = <VariableToken>node.name
        const value = this.evaluate(node.value)
        this.environment.set(token.value, value)
    }

    visitGroupingExpr(node: Ast.GroupingExpr) {
        return this.evaluate(node.expr)
    }

    visitLiteralExpr(node: Ast.LiteralExpr) {
        return node.token.value
    }

    visitReturnStmt(node: Ast.ReturnStmt) {
        let value: Ast.Expression | null = null;
        if (node.value !== null)
            value = this.evaluate(node.value)
        throw new ReturnValue(value)
    }

    visitFuncDeclaration(node: Ast.FuncDeclaration) {
        let func = new BangaFunction(node, this.environment)
        this.environment.set(node.name.value, func)
    }

    visitBlockStmt(node: Ast.BlockStmt) {
        this.executeBlock(node.stmts, this.environment)
    }

    visitCallExpr(node: Ast.CallExpr): any {
        const callee = this.evaluate(node.callee);
        if (!(is<BangaCallable>(callee))) {
            throw new RuntimeError(node.paren, "called non-function");
        }
        const args: Ast.Expression[] = [];
        for (let arg of node.args) {
            args.push(this.evaluate(arg))
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

    visitCaseExpr(node: Ast.CaseExpr) {
        const { expr, cases } = node
        let rv = this.evaluate(expr)
        let res;
        for (let c of cases) {
            res = this.patternMatch(rv, c)
            if (res !== undefined)
                break
        }
        return res
    }

    patternMatch(toMatch: any, c: Ast.CaseExprCase): any {
        const { matcher, ifMatch } = c
        switch (matcher.kind) {
            case 'VariableExpr':
                if (matcher.token.value === '_')
                    return this.evaluate(ifMatch)
            case 'LiteralExpr': {
                const evald = this.evaluate(matcher);
                if (toMatch === evald)
                    return this.evaluate(ifMatch)
                break;
            }
            case 'GroupingExpr': {
                console.log('Not implemented: "GroupingExpr"')
                throw new Error('Not implemented: "GroupingExpr"')
            }
        }
    }

    public evaluate = <T extends Visitable>(node: T): T => {
        return node.acceptVisitor(this)
    }
}
