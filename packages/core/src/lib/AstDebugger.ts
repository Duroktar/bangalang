import { EventEmitter } from "events";
import Semaphore from 'ts-semaphore';
import * as Ast from "../Ast";
import { Interpreter } from "../interface/Interpreter";
import { getToken, TokenKind } from "../interface/Lexer";
import { BangaCallable, Environment, ReturnValue, RuntimeError } from "../interface/Runtime";
import { Visitable } from "../interface/Visitor";
import { Context, createContext, Debugger } from "./DebuggerMode";
import { createEnvironment } from "./Environment";
import { AsyncBangaFunction } from "./RuntimeLibrary";
import { format, is } from "./utils";

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
    public environment: Environment
    public globals: Environment
    public process: AstProcess
    public debugService: AstDebugger
    public context: Context

    public frames: StackFrame[] = []

    constructor(_globals: Environment) {
        this.environment = _globals
        this.globals = _globals
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

    public interpret = async (instructions: Ast.Program) => {
        await this.semaphore.aquire()
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
        }
    }

    public evaluate = async <T extends Visitable>(node: T): Promise<T> => {
        const previousNode = this.context.currentNode
        this.context.currentNode = node

        const value = await this.semaphore
            .use(async () => {
                this.semaphore.release()
                return await node.acceptVisitor(this)
            })

        await this.semaphore.aquire()

        this.context.currentNode = previousNode
        return value
    }

    public execute = async (node: Visitable) => {
        await this.evaluate(node)
    }

    public resolve = (node: Ast.AstNode, scope: number) => {
        this.locals.set(node, scope)
    }

    public executeBlock = async (statements: Ast.Program, environment: Environment) => {
        const previous = this.environment;
        try {
            this.environment = environment;
            for (const statement of statements) {
                await this.execute(statement)
            }
        } finally {
            this.environment = previous;
        }
    }

    public evaluateBlock = async (block: Ast.BlockStmt, environment: Environment) => {
        const previous = this.environment;
        let result: Ast.Declaration | undefined = undefined;
        try {
            this.environment = environment;
            for (const statement of block.stmts)
                result = await this.evaluate(statement)
        } finally {
            this.environment = previous;
        }
        if (result === undefined) {
            throw new RuntimeError(getToken(block), 'Block Expression must end in expression.')
        }
        return result
    }

    visitClassDeclaration = async (node: Ast.ClassDeclaration) => {
        throw new Error("Method not implemented (visitClassDeclaration).");
    }

    visitExpressionStmt = async (node: Ast.ExpressionStmt) => {
        const val = await this.evaluate(node.expr)
        await this.onTracepoint(node)
        return val
    }

    visitLetDeclaration = async (node: Ast.LetDeclaration) => {
        const value = node.init
            ? await this.evaluate(node.init)
            : undefined
        await this.onTracepoint(node)
        this.environment.define(node.name.value, value)
    }

    visitIfExprStmt = async (node: Ast.IfExprStmt) => {
        const cond = await this.evaluate(node.cond)
        const res = node[cond ? 'pass' : 'fail'];
        await this.onTracepoint(node)
        return await this.evaluateBlock(res, this.environment)
    }

    visitVariableExpr = async (node: Ast.VariableExpr) => {
        const val = this.lookupVariable(node.name, node)
        await this.onTracepoint(node)
        return val
    }

    visitAssignExpr = async (node: Ast.AssignExpr) => {
        const value = await this.evaluate(node.value)

        await this.onTracepoint(node)

        const distance = this.locals.get(node)
        if (distance != null) {
            this.environment.assignAt(distance, node.name, value)
        } else {
            this.globals.assign(node.name, value)
        }
    }

    visitGroupingExpr = async (node: Ast.GroupingExpr) => {
        const val = await this.evaluate(node.expr)
        await this.onTracepoint(node)
        return val
    }

    visitLiteralExpr = async (node: Ast.LiteralExpr) => {
        const val = node.value
        await this.onTracepoint(node)
        return val
    }

    visitReturnStmt = async (node: Ast.ReturnStmt) => {
        let value: Ast.Expression | null = null;
        if (node.value !== null)
            value = await this.evaluate(node.value)
        await this.onTracepoint(node)
        this.frames.pop()
        throw new ReturnValue(value)
    }

    visitFuncDeclaration = async (node: Ast.FuncDeclaration) => {
        const func = new AsyncBangaFunction(node, this.environment)
        await this.onTracepoint(node)
        this.environment.define(node.name.value, func)
    }

    visitBlockStmt = async (node: Ast.BlockStmt) => {
        await this.executeBlock(node.stmts, createEnvironment(this.environment))
        await this.onTracepoint(node)
    }

    visitCallExpr = async (node: Ast.CallExpr): Promise<any> => {
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
            index: this.frames.length - 1,
        })

        await this.onTracepoint(node)

        const rv =  await callee.call(this, args)

        this.frames.pop()
        return rv
    }

    visitBinaryExpr = async (node: Ast.BinaryExpr) => {
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

    visitCaseExpr = async (node: Ast.CaseExpr) => {
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

    patternMatch = async (toMatch: any, c: Ast.CaseExprCase): Promise<any> => {
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
                // console.log('Not implemented: "GroupingExpr"')
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

export class AstDebugger extends Debugger {
    constructor(public interpreter: AstDebuggableInterpreter) {
        super()
    }
    public runInterpreter = () => {
        this.interpreter.run()
    }
    public tracepointReachedFor = async (node: Ast.AstNode) => {
        await this.interpreter.process.pause()
        this.interpreter.process.emit(
            'breakpoint-reached',
            getToken(node).lineInfo.start.line,
        )
    }
}
