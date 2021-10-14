import * as Ast from "../Ast";
import { Visitable } from "../interface/Visitor";

export type Context = {
    sender?: Context
    currentNode?: Visitable
    returnReached: boolean
};

export const createContext: (currentNode?: Visitable, sender?: Context) => Context
    = (currentNode, sender) => ({ currentNode, returnReached: false, sender })


abstract class DebuggerMode {
    constructor(_debugger: ModeDebugger) {
        this.debugger = _debugger;
    }
    public debugger: ModeDebugger;
    abstract onTracepoint(node: Ast.AstNode, ctx?: unknown): any;
    abstract stepOver(): any;
    abstract stepInto(): any;
    abstract continue(): any;
}

class ContinueMode extends DebuggerMode {
    onTracepoint(node: Ast.AstNode) {
        if (this.debugger.isBreakpoint(node))
            return this.debugger.tracepointReachedFor(node);
    }
    public stepOver = () => this.debugger.setMode('step-over');
    public stepInto = () => this.debugger.setMode('step-into');
    public continue = () => this.debugger.runInterpreter();
}

class StepIntoMode extends DebuggerMode {
    onTracepoint(node: Ast.AstNode) {
        return this.debugger.tracepointReachedFor(node);
    }
    public stepOver = () => this.debugger.setMode('step-over');
    public stepInto = () => this.debugger.runInterpreter();
    public continue = () => this.debugger.setMode('continue');
}

class StepOverMode extends DebuggerMode {
    constructor(_debugger: ModeDebugger, context: Context) {
        super(_debugger);
        this.context = context;
    }
    onTracepoint(node: Ast.AstNode) {
        if (this.context === this.debugger.context)
            return this.debugger.tracepointReachedFor(node);
    }
    public stepOver = () => this.debugger.runInterpreter();
    public stepInto = () => this.debugger.setMode('step-into');
    public continue = () => this.debugger.setMode('continue');

    public context: Context;
}

interface ModeDebugger {
    isBreakpoint(node: Ast.Declaration): any;
    tracepointReachedFor(node: Ast.Declaration): any;
    setMode(mode: 'step-over' | 'step-into' | 'continue'): any;
    runInterpreter(): any;
    context: Context;
}

export abstract class Debugger implements ModeDebugger {
    public breakpoints: Set<Ast.AstNode> = new Set();
    public context: Context = createContext();
    public mode: DebuggerMode = new ContinueMode(this);

    public stepOver = () => this.mode.stepOver();
    public stepInto = () => this.mode.stepInto();
    public continue = () => this.mode.continue();

    public onTracepoint = (node: Ast.AstNode, ctx?: unknown) => {
        return this.mode.onTracepoint(node, ctx);
    };
    public addBreakpointOn = (node: Ast.AstNode) => {
        this.breakpoints.add(node);
    };
    public isBreakpoint = (node: Ast.AstNode) => {
        return this.breakpoints.has(node);
    };

    public setMode = (mode: 'continue' | 'step-into' | 'step-over') => {
        switch (mode) {
            case 'continue': {
                this.mode = new ContinueMode(this);
                break;
            }
            case 'step-into': {
                this.mode = new StepIntoMode(this);
                break;
            }
            case 'step-over': {
                this.mode = new StepOverMode(this, this.context);
                break;
            }
        }
    };

    public abstract runInterpreter: () => any;
    public abstract tracepointReachedFor: (node: Ast.AstNode) => any;
}
