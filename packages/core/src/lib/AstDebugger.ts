import { EventEmitter } from "events";
import Semaphore from 'ts-semaphore';
import * as Ast from "../Ast";
import { Interpreter } from "../interface/Interpreter";
import { getToken, TokenKind } from "../interface/Lexer";
import { Reader } from "../interface/Reader";
import { BangaCallable, Environment, ReturnValue, RuntimeError } from "../interface/Runtime";
import { Visitable } from "../interface/Visitor";
import { AsyncBangaFunction, createEnvironment } from "./RuntimeLibrary";
import { format, is } from "./utils";

type Context = {
    sender?: Context
    currentNode?: Visitable
    returnReached: boolean
};

const createContext: (currentNode?: Visitable, sender?: Context) => Context
    = (currentNode, sender) => ({ currentNode, returnReached: false, sender })

export type ProcessEvents =
    | 'breakpoint-reached'
    | 'complete'
    ;

type AstProcess = {
    resume: () => void
    pause: () => Promise<void>
    on: (event: ProcessEvents, callback: (...args: any[]) => void) => EventEmitter
    emit: (event: ProcessEvents, ...args: any[]) => boolean
};

type StackFrame = {
    name: string;
    index: number;
};

export class AstDebuggableInterpreter implements Interpreter {

    public globals: Environment
    public environment: Environment
    public process: AstProcess
    public debugService: AstDebugger
    public context: Context

    public frames: StackFrame[] = []

    constructor(public reader: Reader, public env: Environment) {
        this.globals = createEnvironment(env)
        this.environment = this.globals
        this.debugService = new AstDebugger(this)
        this.context = createContext()
        this.semaphore = new Semaphore(1)

        const events = new EventEmitter({ captureRejections: true });

        this.process = {
            pause: () => this.semaphore.aquire(),
            resume: () => this.semaphore.release(),
            on: (event: ProcessEvents, callback: (...args: any[]) => void) =>{
                return events.on(event, callback)
            },
            emit: (event: ProcessEvents, ...data: any[]) =>{
                return events.emit(event, ...data)
            },
        }
    }

    public run = () => {
        return this.process.resume()
    }

    public onTracepoint = (node: Ast.AstNode) => {
        return this.debugService.onTracepoint(node, this.context)
    }

    public async interpret(instructions: Ast.Program) {
        try {
            for (const line of instructions) {
                await this.evaluate(line)
            }
        } catch (err) {
            if (err instanceof RuntimeError)
                console.log('Runtime error:', err.message)
            throw err
        } finally {
            this.process.emit('complete')
            return null
        }
    }

    public evaluate = async <T extends Visitable>(node: T): Promise<T> => {
        const previousNode = this.context.currentNode
        this.context.currentNode = node

        const value = await this.semaphore
            .use(() => {
                this.semaphore.release()
                return node.acceptVisitor(this)
            })

        await this.semaphore.aquire()

        this.context.currentNode = previousNode
        return value
    }

    public execute = async (node: Visitable) => {
        this.evaluate(node)
    }

    public resolve = (node: Ast.AstNode, scope: number) => {
        this.locals.set(node, scope)
    }

    public async executeBlock(statements: Ast.Program, env: Environment) {
        const previous = this.environment;
        try {
            this.environment = createEnvironment(env);
            for (const statement of statements) {
                await this.execute(statement)
            }
        } finally {
            this.environment = previous;
        }
    }

    async visitClassDeclaration(node: Ast.ClassDeclaration) {
        throw new Error("Method not implemented (visitClassDeclaration).");
    }

    async visitExpressionStmt(node: Ast.ExpressionStmt) {
        await this.evaluate(node.expr)
        await this.onTracepoint(node)
    }

    async visitLetDeclaration(node: Ast.LetDeclaration) {
        const value = node.init
            ? await this.evaluate(node.init)
            : undefined
        await this.onTracepoint(node)
        this.environment.define(node.name.value, value)
    }

    async visitVariableExpr(node: Ast.VariableExpr) {
        const val = this.lookupVariable(node.name, node)
        await this.onTracepoint(node)
        return val
    }

    async visitAssignExpr(node: Ast.AssignExpr) {
        const value = await this.evaluate(node.value)

        await this.onTracepoint(node)

        const distance = this.locals.get(node)
        if (distance != null) {
            this.environment.assignAt(distance, node.name, value)
        } else {
            this.globals.assign(node.name, value)
        }
    }

    async visitGroupingExpr(node: Ast.GroupingExpr) {
        const val = await this.evaluate(node.expr)
        await this.onTracepoint(node)
        return val
    }

    async visitLiteralExpr(node: Ast.LiteralExpr) {
        const val = node.token.value
        await this.onTracepoint(node)
        return val
    }

    async visitReturnStmt(node: Ast.ReturnStmt) {
        let value: Ast.Expression | null = null;
        if (node.value !== null)
            value = await this.evaluate(node.value)
        await this.onTracepoint(node)
        this.frames.pop()
        throw new ReturnValue(value)
    }

    async visitFuncDeclaration(node: Ast.FuncDeclaration) {
        const func = new AsyncBangaFunction(node, this.environment)
        await this.onTracepoint(node)
        this.environment.define(node.name.value, func)
    }

    async visitBlockStmt(node: Ast.BlockStmt) {
        this.executeBlock(node.stmts, this.environment)
        await this.onTracepoint(node)
    }

    async visitCallExpr(node: Ast.CallExpr): Promise<any> {
        let callee = await this.evaluate(node.callee)
        if (!(is<BangaCallable>(callee))) {
            throw new RuntimeError(node.paren, "called non-function")
        }
        const args: Ast.Expression[] = []
        for (let arg of node.args) {
            args.push(await this.evaluate(arg))
        }
        if (!callee.checkArity(args.length)) {
            const msg = "Expected {0} arguments but got {1}."
            const err = format(msg, callee.arity(), args.length)
            throw new RuntimeError(node.paren, err)
        }

        this.frames.push({
            name: callee.toString(),
            index: this.frames.length,
        })

        await this.onTracepoint(node)

        const rv =  await callee.call(this, args)

        this.frames.pop()
        return rv
    }

    async visitBinaryExpr(node: Ast.BinaryExpr) {
        const left = await this.evaluate(node.left)
        const right = await this.evaluate(node.right)
        await this.onTracepoint(node)
        switch (node.op.kind) {
            case TokenKind.PLUS:
                return <any>left + <any>right
            case TokenKind.MINUS:
                return <any>left - <any>right
        }
    }

    async visitCaseExpr(node: Ast.CaseExpr) {
        const { expr, cases } = node
        const rv = await this.evaluate(expr)
        let res;
        for (const c of cases) {
            res = await this.patternMatch(rv, c)
            if (res !== undefined)
                break
        }
        await this.onTracepoint(node)
        return res
    }

    async patternMatch(toMatch: any, c: Ast.CaseExprCase): Promise<any> {
        const { matcher, ifMatch } = c
        switch (matcher.kind) {
            case 'VariableExpr':
                if (matcher.token.value === '_')
                    return await this.evaluate(ifMatch)
            case 'LiteralExpr': {
                const evald = await this.evaluate(matcher);
                if (toMatch === evald)
                    return await this.evaluate(ifMatch)
                break;
            }
            case 'GroupingExpr': {
                console.log('Not implemented: "GroupingExpr"')
                throw new Error('Not implemented: "GroupingExpr"')
            }
        }
    }

    private lookupVariable = (name: string, expr: Ast.AstNode) => {
        const distance = this.locals.get(expr)
        if (distance != null) {
            return this.environment.getAt(distance, name)
        } else {
            return this.globals.get(name)
        }
    }

    private locals: Map<Ast.AstNode, number> = new Map()
    private semaphore: Semaphore
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
            return this.debugger.tracepointReachedFor(node)
    }
    public stepOver = () => this.debugger.setMode('step-over')
    public stepInto = () => this.debugger.setMode('step-into')
    public continue = () => this.debugger.runInterpreter()
}
class StepIntoMode extends DebuggerMode {
    onTracepoint(node: Ast.AstNode) {
        return this.debugger.tracepointReachedFor(node)
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
    onTracepoint(node: Ast.AstNode) {
        if (this.context === this.debugger.context)
            return this.debugger.tracepointReachedFor(node)
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
    public breakpoints: Set<Ast.AstNode> = new Set()
    public mode: DebuggerMode
    public context: Context = createContext()
    public stepOver = () => this.mode.stepOver()
    public stepInto = () => this.mode.stepInto()
    public continue = () => this.mode.continue()
    public onTracepoint = (node: Ast.AstNode, ctx?: unknown) => {
        return this.mode.onTracepoint(node, ctx)
    }
    public runInterpreter = () => {
        this.interpreter.run()
    }
    public addBreakpointOn = (node: Ast.AstNode) => {
        this.breakpoints.add(node)
    }
    public tracepointReachedFor = async (node: Ast.AstNode) => {
        this.interpreter.process.emit(
            'breakpoint-reached',
            getToken(node).lineInfo.start.line,
        )
        await this.interpreter.process.pause()
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
