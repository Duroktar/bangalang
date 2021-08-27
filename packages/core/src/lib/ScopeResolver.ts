import { AssignExpr, AstNode, BinaryExpr, BlockStmt, CallExpr, CaseExpr, ClassDeclaration, Expression, ExpressionStmt, FuncDeclaration, GroupingExpr, IfExprStmt, LetDeclaration, LiteralExpr, Program, ReturnStmt, VariableExpr } from "../Ast";
import { Interpreter } from "../interface/Interpreter";
import { IdentifierToken } from "../interface/Lexer";
import { ResolutionError } from "../interface/Resolver";
import { Visitor } from "../interface/Visitor";
import { TypeEnv } from "./HindleyMilner";
import { BangaImportFunction } from "./RuntimeLibrary";
import { Stack } from "./Stack";

enum FunctionType {
    NONE,
    FUNCTION
}

export class ScopeResolver implements Visitor {
    public errors: ResolutionError[] = []

    constructor(public interpreter: Interpreter, public typeEnv: TypeEnv) {}

    public resolve = (program: Program | AstNode) => {
        if (Array.isArray(program)) {
            for (let node of program)
                this.visit(node)
        } else {
            this.visit(program)
        }
    }
    private beginScope = () => {
        this.scopes.push(new Map())
    }
    private endScope = () => {
        this.scopes.pop()
    }
    private declare = (token: IdentifierToken) => {
        if (this.scopes.isEmpty())
            return
        const scope = this.scopes.peek()
        if (scope.has(token.value)) {
            this.errors.push(new ResolutionError(token,
                "Already a variable with this name in this scope."))
        }
        scope.set(token.value, false)
    }
    private define = (token: IdentifierToken) => {
        if (this.scopes.isEmpty()) { return }
        this.scopes.peek().set(token.value, true)
    }
    private resolveLocal = (expr: Expression, name: string) => {
        for (let i = this.scopes.size() - 1; i >= 0; i--) {
            if (this.scopes.atIndex(i).has(name)) {
                this.interpreter.resolve(expr, this.scopes.size() - 1 - i)
                return
            }
        }
    }
    private resolveFunction = (func: FuncDeclaration, type: FunctionType) => {
        const enclosingFunction = this.currentFunction
        this.currentFunction = type

        this.beginScope()
        for (const param of func.params) {
          this.declare(param)
          this.define(param)
        }
        this.resolve(func.body)
        this.endScope()

        this.currentFunction = enclosingFunction
    }
    private visit = (node: AstNode): void => {
        node?.acceptVisitor(this)
    }
    visitExpressionStmt(node: ExpressionStmt) {
        this.resolve(node.expr)
    }
    visitClassDeclaration(node: ClassDeclaration) {
        this.resolve(node.methods)
    }
    visitFuncDeclaration(node: FuncDeclaration) {
        this.declare(node.name)
        this.define(node.name)
        this.resolveFunction(node, FunctionType.FUNCTION)
    }
    visitLetDeclaration(node: LetDeclaration) {
        this.declare(node.name)
        if (node.init)
            this.resolve(node.init)
        this.define(node.name)
    }
    visitBlockStmt(node: BlockStmt) {
        this.beginScope()
        this.resolve(node.stmts)
        this.endScope()
    }
    visitGroupingExpr(node: GroupingExpr) {
        this.resolve(node.expr)
    }
    visitCaseExpr(node: CaseExpr) {
        this.resolve(node.cases.map(o => o.ifMatch))
        this.resolve(node.cases.map(o => o.matcher))
        this.resolve(node.expr)
    }
    visitIfExprStmt(node: IfExprStmt) {
        this.resolve(node.cond)
        this.resolve(node.pass)
        if (node.fail) this.resolve(node.fail)
    }
    visitLiteralExpr(node: LiteralExpr) {
        return
    }
    visitReturnStmt(node: ReturnStmt) {
        if (this.currentFunction == FunctionType.NONE) {
            this.errors.push(new ResolutionError(
                node.keyword, "Can't return from top-level code."))
        }
        this.resolve(node.value)
    }
    visitVariableExpr(node: VariableExpr) {
        if (!this.scopes.isEmpty() && this.scopes.peek().get(node.name) === false) {
            this.errors.push(new ResolutionError(node.token,
                "Can't read local variable in its own initializer."))
        }
        this.resolveLocal(node, node.name)
    }
    visitAssignExpr(node: AssignExpr) {
        this.resolve(node.value)
        this.resolveLocal(node, node.name.value)
    }
    visitBinaryExpr(node: BinaryExpr) {
        this.resolve(node.left)
        this.resolve(node.right)
    }
    visitCallExpr(node: CallExpr) {
        const name = (<any>node.callee).name;
        const env = this.interpreter.globals;
        const importFunc = env.values.get(name)
        if (importFunc instanceof BangaImportFunction) {
            const args = node.args.map((o: any) => o.value)
            importFunc
                .declareImports(this.typeEnv, args)
                // .forEach(([name, _]) => {
                //     if (name === 'arch') {
                //         console.log(node)
                //     }
                //     this.resolveLocal(node, name)
                //     // this.declare({ value: name } as any)
                //     // this.define({ value: name } as any)
                // })
        }
        this.resolve(node.callee)
        this.resolve(node.args)
    }

    private scopes: Stack<Map<string, boolean>> = new Stack()
    private currentFunction = FunctionType.NONE
}
