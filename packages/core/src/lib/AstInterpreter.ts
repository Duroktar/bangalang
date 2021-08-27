import type * as Ast from "../Ast";
import { Interpreter } from "../interface/Interpreter";
import { getToken, TokenKind } from "../interface/Lexer";
import { BangaCallable, Environment, ReturnValue, RuntimeError } from "../interface/Runtime";
import type { Visitable } from "../interface/Visitor";
import { createEnvironment } from "./Environment";
import { BangaFunction } from "./RuntimeLibrary";
import { format, is } from "./utils";

export class AstInterpreter implements Interpreter {
    public environment: Environment
    public globals: Environment

    constructor(_globals: Environment) {
        this.environment = _globals
        this.globals = _globals
    }

    public interpret(instructions: Ast.Program): any {
        try {
            for (const line of instructions) {
                this.execute(line)
            }
        } catch (err) {
            if (err instanceof RuntimeError)
                console.log('Runtime error:', err.message)
            throw err
        }
    }

    public evaluate = <T extends Visitable>(node: T): T => {
        return node.acceptVisitor(this)
    }

    public execute = (node: Visitable): void => {
        this.evaluate(node)
    }

    public resolve = (node: Ast.AstNode, scope: number) => {
        this.locals.set(node, scope)
    }

    public executeBlock = (statements: Ast.Declaration[], environment: Environment) => {
        const previous = this.environment;
        try {
            this.environment = environment;
            for (const statement of statements)
                this.execute(statement)
        } finally {
            this.environment = previous;
        }
    }

    public evaluateBlock = (block: Ast.BlockStmt, environment: Environment) => {
        const previous = this.environment;
        let result: Ast.Declaration | undefined = undefined;
        try {
            this.environment = environment;
            for (const statement of block.stmts)
                result = this.evaluate(statement)
        } finally {
            this.environment = previous;
        }
        if (result === undefined) {
            throw new RuntimeError(getToken(block), 'Block Expression must end in expression.')
        }
        return result
    }

    visitClassDeclaration(node: Ast.ClassDeclaration) {
        throw new Error("Method not implemented (visitClassDeclaration).");
    }

    visitExpressionStmt(node: Ast.ExpressionStmt) {
        return this.evaluate(node.expr)
    }

    visitLetDeclaration(node: Ast.LetDeclaration) {
        const value = node.init
            ? this.evaluate(node.init)
            : undefined

        this.environment.define(node.name.value, value)
    }

    visitVariableExpr(node: Ast.VariableExpr) {
        return this.lookUpVariable(node.name, node)
    }

    visitAssignExpr(node: Ast.AssignExpr) {
        const value = this.evaluate(node.value)

        const distance = this.locals.get(node)
        if (distance != null) {
            this.environment.assignAt(distance, node.name, value)
        } else {
            this.globals.assign(node.name, value)
        }
    }

    visitGroupingExpr(node: Ast.GroupingExpr) {
        return this.evaluate(node.expr)
    }

    visitIfExprStmt(node: Ast.IfExprStmt) {
        const cond = this.evaluate(node.cond)
        if (!!cond)
            return this.evaluateBlock(node.pass, this.environment)
        else if (node.fail)
            return this.evaluateBlock(node.fail, this.environment)
    }

    visitLiteralExpr(node: Ast.LiteralExpr) {
        return node.value
    }

    visitReturnStmt(node: Ast.ReturnStmt) {
        let value: Ast.Expression | null = null;
        if (node.value !== null)
            value = this.evaluate(node.value)
        throw new ReturnValue(value)
    }

    visitFuncDeclaration(node: Ast.FuncDeclaration) {
        const func = new BangaFunction(node, this.environment)
        this.environment.define(node.name.value, func)
    }

    visitBlockStmt(node: Ast.BlockStmt) {
        this.executeBlock(node.stmts, createEnvironment(this.environment))
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
                // console.log('Not implemented: "GroupingExpr"')
                throw new Error('Not implemented: "GroupingExpr"')
            }
        }
    }

    private lookUpVariable = (name: string, expr: Ast.AstNode) => {
        const distance = this.locals.get(expr)
        if (distance != null) {
            return this.environment.getAt(distance, name)
        } else {
            return this.globals.get(name)
        }
    }

    private locals: Map<Ast.AstNode, number> = new Map()
}
