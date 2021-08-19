import { EventEmitter } from "events";
import Semaphore from 'ts-semaphore';
import * as Ast from "../Ast";
import { Interpreter } from "../interface/Interpreter";
import { TokenKind, VariableToken } from "../interface/Lexer";
import { Reader } from "../interface/Reader";
import { BangaCallable, Environment, ReturnValue, RuntimeError } from "../interface/Runtime";
import { Visitable } from "../interface/Visitor";
import { AsyncBangaFunction, BangaFunction, createEnvironment } from "./RuntimeLibrary";
import { format, is } from "./utils";

type Context = {
    sender?: Context
    currentNode?: Visitable
    returnReached: boolean
};

const createContext: (currentNode?: Visitable, sender?: Context) => Context
    = (currentNode, sender) => ({ currentNode, returnReached: false, sender })

type AstProcess = {
    resume: () => void
    pause: () => void
    events: EventEmitter
};

export class AstDebuggableInterpreter implements Interpreter {

    public globals: Environment = new Map()
    public environment: Environment = this.globals
    public semaphore!: Semaphore;
    public process!: AstProcess

    constructor(public reader: Reader, public env: Environment) {
        [...env.entries()]
            .map(([key, func]) => this.environment.set(key, func))
        this.debugService = new AstDebugger(this)
        this.context = createContext()
    }

    public run = () => {
        return this.process.resume()
    }

    public onTracepoint = (node: Ast.AstNode) => {
        this.debugService.onTracepoint(node, this.context)
    }

    public visit = async <T extends Visitable>(node: T): Promise<T> => {
        const previousNode = this.context.currentNode
        this.context.currentNode = node

        const value = await this.semaphore
            .use(() => node.acceptVisitor(this))

        this.context.currentNode = previousNode
        return value
    }

    public async execute(program: Ast.Program): Promise<any> {
        this.semaphore = new Semaphore(1)
        this.context = createContext()
        this.process = {
            pause: () => this.semaphore.aquire(),
            resume: () => this.semaphore.release(),
            events: new EventEmitter({captureRejections: true}),
        }
        this.process.pause()

        return new Promise(async (resolve, reject) => {
            try {
                const values: any[] = []
                for (const node of program) {
                    const val = await this.visit(node)
                    values.push(val)
                }
                resolve(values)
            } catch (err) {
                resolve(null)
            } finally {
                this.process.events.emit('complete')
            }
        })
    }

    public async executeBlock(program: Ast.Program, env: Environment) {
        const previous = this.environment;
        try {
            this.environment = createEnvironment(env);
            for (const node of program) {
                await this.visit(node)
            }
        } finally {
            this.environment = previous;
        }
    }

    async visitClassDeclaration(node: Ast.ClassDeclaration) {
        throw new Error("Method not implemented (visitClassDeclaration).");
    }

    async visitExpressionStmt(node: Ast.ExpressionStmt) {
        const val = await this.visit(node.expr)
        this.onTracepoint(node)
        return val
    }

    async visitLetDeclaration(node: Ast.LetDeclaration) {
        const token = <VariableToken>node.name
        const value = node.init
            ? await this.visit(node.init)
            : undefined
        this.onTracepoint(node)
        this.environment.set(token.value, value)
    }

    async visitVariableExpr(node: Ast.VariableExpr) {
        const val = this.environment.get(node.name)
        this.onTracepoint(node)
        return val
    }

    async visitAssignExpr(node: Ast.AssignExpr) {
        const token = <VariableToken>node.name
        const value = await this.visit(node.value)
        this.onTracepoint(node)
        this.environment.set(token.value, value)
    }

    async visitGroupingExpr(node: Ast.GroupingExpr) {
        const val = await this.visit(node.expr)
        this.onTracepoint(node)
        return val
    }

    async visitLiteralExpr(node: Ast.LiteralExpr) {
        const val = node.token.value
        this.onTracepoint(node)
        return val
    }

    async visitReturnStmt(node: Ast.ReturnStmt) {
        let value: Ast.Expression | null = null;
        if (node.value !== null)
            value = await this.visit(node.value)
        this.onTracepoint(node)
        throw new ReturnValue(value)
    }

    async visitFuncDeclaration(node: Ast.FuncDeclaration) {
        const func = new BangaFunction(node, this.environment)
        this.onTracepoint(node)
        this.environment.set(node.name.value, func)
    }

    async visitBlockStmt(node: Ast.BlockStmt) {
        this.executeBlock(node.stmts, this.environment)
        this.onTracepoint(node)
    }

    async visitCallExpr(node: Ast.CallExpr): Promise<any> {
        let callee = await this.visit(node.callee);
        if (!(is<BangaCallable>(callee))) {
            throw new RuntimeError(node.paren, "called non-function");
        }

        const args: Ast.Expression[] = [];
        for (let arg of node.args) {
            args.push(await this.visit(arg))
        }
        if (!callee.checkArity(args.length)) {
            const msg = "Expected {0} arguments but got {1}.";
            const err = format(msg, callee.arity(), args.length);
            throw new RuntimeError(node.paren, err);
        }

        const func = (callee instanceof BangaFunction)
            ? AsyncBangaFunction.from(callee)
            : callee

        const val = await func.call(this, args);
        this.onTracepoint(node)
        return val
    }

    async visitBinaryExpr(node: Ast.BinaryExpr) {
        const left = await this.visit(node.left)
        const right = await this.visit(node.right)
        this.onTracepoint(node)
        switch (node.op.kind) {
            case TokenKind.PLUS:
                return <any>left + <any>right
            case TokenKind.MINUS:
                return <any>left - <any>right
        }
    }

    async visitCaseExpr(node: Ast.CaseExpr) {
        const { expr, cases } = node
        const rv = await this.visit(expr)
        let res;
        for (const c of cases) {
            res = await this.patternMatch(rv, c)
            if (res !== undefined)
                break
        }
        this.onTracepoint(node)
        return res
    }

    async patternMatch(toMatch: any, c: Ast.CaseExprCase): Promise<any> {
        const { matcher, ifMatch } = c
        switch (matcher.kind) {
            case 'VariableExpr':
                if (matcher.token.value === '_')
                    return await this.visit(ifMatch)
            case 'LiteralExpr': {
                const evald = await this.visit(matcher);
                if (toMatch === evald)
                    return await this.visit(ifMatch)
                break;
            }
            case 'GroupingExpr': {
                console.log('Not implemented: "GroupingExpr"')
                throw new Error('Not implemented: "GroupingExpr"')
            }
        }
    }

    public debugService: AstDebugger
    public context: Context
}

abstract class DebuggerMode {
    constructor(_debugger: AstDebugger) {
        this.debugger = _debugger;
    }
    public debugger: AstDebugger
    abstract onTracepoint(node: Ast.AstNode, ctx?: unknown): any;
    abstract stepOver(): any
    abstract stepInto(): any
    abstract continue(): any
}
class ContinueMode extends DebuggerMode {
    onTracepoint(node: Ast.AstNode) {
        if (this.debugger.isBreakpoint(node))
            this.debugger.tracepointReachedFor(node)
    }
    public stepOver = () => this.debugger.setMode('step-over')
    public stepInto = () => this.debugger.setMode('step-into')
    public continue = () => this.debugger.runInterpreter()
}
class StepIntoMode extends DebuggerMode {
    onTracepoint(node: Ast.AstNode) {
        this.debugger.tracepointReachedFor(node)
    }
    public stepOver = () => this.debugger.setMode('step-over')
    public stepInto = () => this.debugger.runInterpreter()
    public continue = () => this.debugger.setMode('continue')
}
class StepOverMode extends DebuggerMode {
    constructor(_debugger: AstDebugger, context: Context) {
        super(_debugger)
        this.context = context
    }
    onTracepoint(node: Ast.AstNode): void{
        if (this.context === this.debugger.context)
            this.debugger.tracepointReachedFor(node)
    }
    public stepOver = () => this.debugger.runInterpreter()
    public stepInto = () => this.debugger.setMode('step-into')
    public continue = () => this.debugger.setMode('continue')

    public context: Context
}

export class AstDebugger {
    constructor(public interpreter: AstDebuggableInterpreter) {
        this.mode = new ContinueMode(this)
    }
    public breakpoints: Set<any> = new Set()
    public mode: DebuggerMode
    public context: Context = createContext()
    public stepOver = () => this.mode.stepOver()
    public stepInto = () => this.mode.stepInto()
    public continue = () => this.mode.continue()
    public onTracepoint = (node: Ast.AstNode, ctx?: unknown) => {
        this.mode.onTracepoint(node, ctx)
    }
    public runInterpreter = () => {
        this.interpreter.run()
    }
    public addBreakpointOn = (node: Ast.AstNode) => {
        this.breakpoints.add(node)
    }
    public tracepointReachedFor = (node: Ast.AstNode) => {
        console.log('Tracepoint reached:', node.toString())
        this.interpreter.process.pause()
    }
    public isBreakpoint = (node: Ast.AstNode) => {
        return this.breakpoints.has(node)
    }
    public setMode = (mode: 'continue' | 'step-into' | 'step-over') => {
        switch (mode) {
            case 'continue': {
                this.mode = new ContinueMode(this)
                break }
            case 'step-into': {
                this.mode = new StepIntoMode(this)
                break }
            case 'step-over': {
                this.mode = new StepOverMode(this, this.context)
                break }
        }
    }
}
