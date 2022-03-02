import { AstDebuggableInterpreter, Declaration, FileReader, getFirstNodeAtLine, GlobalTypes, HindleyMilner, Program, Resolver, ScopeResolver, StdLib, Token, TokenLexer, TokenParser, Typed, TypeEnv } from "@bangalang/core";
import { EventEmitter } from 'events';

export interface FileAccessor {
	readFile(path: string): Promise<string>;
}

export interface IRuntimeBreakpoint {
	id: number;
	line: number;
	verified: boolean;
}

interface IRuntimeStepInTargets {
	id: number;
	label: string;
}

interface IRuntimeStackFrame {
	index: number;
	name: string;
	file: string;
	line: number;
	column?: number;
	instruction?: number;
}

interface IRuntimeStack {
	count: number;
	frames: IRuntimeStackFrame[];
}

// interface RuntimeDisassembledInstruction {
// 	address: number;
// 	instruction: string;
// }

export type IRuntimeVariableType = string | number | boolean | Typed<Declaration> | IRuntimeVariable[];

export interface IRuntimeVariable {
	name: string;
	value: IRuntimeVariableType;
}

// interface Word {
// 	name: string;
// 	index: number
// }

export class BangaRuntime extends EventEmitter {
    private _sourceFile: string = '';
    private _breakpointId: number = 0;
    private _currentLine: number = 0;

    public _interpreter?: AstDebuggableInterpreter;
    public _reader!: FileReader;
    public _parser!: TokenParser;
    public _lexer!: TokenLexer;
    public _resolver!: Resolver<any>;
    public _typeChecker!: HindleyMilner;

    public _tokens: Token[] = [];
    public _ast!: Program;
    public _typeEnv!: TypeEnv;

    public debug;
    private _breakPoints: Map<string, IRuntimeBreakpoint[]> = new Map();

	public get sourceFile() {
		return this._sourceFile;
	}

	constructor(public _fileAccessor: FileAccessor) {
		super();
        // if (this.debug) {
        //     console.log(this._fileAccessor);
        //     console.log(this._currentLine);
        // }
	}

    initializeRuntime = async (program: string) => {
        // console.log('bangaRuntime: initializeRuntime');
        // console.log({ program });

        if (!this._interpreter) {
            this._initializeRuntime(program);
        }

        this._interpreter?.process.on('breakpoint-reached', line => {
            // console.log('breakpoint-reached!');

            this._currentLine = line;

            // is there a source breakpoint?
            const breakpoints = this._breakPoints.get(this.sourceFile)!;
            const bp = breakpoints.find(bp => bp.line === line);

            if (bp) {
                bp.verified = true;
                this.sendEvent('breakpointValidated', bp);
                this.sendEvent('stopOnBreakpoint');
            }
        });

        this._interpreter?.process.on('complete', () => {
            this.sendEvent('end');
        });

        this._interpreter?.interpret(this._ast);
        this._interpreter?.debugService.continue();
    };

    private _initializeRuntime(program: string) {
        // console.log('bangaRuntime: _initializeRuntime');

        this._reader = new FileReader(program);
        this._lexer = new TokenLexer(this._reader);
        this._parser = new TokenParser(this._reader);
        this._typeEnv = new TypeEnv(GlobalTypes);
        this._typeChecker = new HindleyMilner(this._reader, this._typeEnv);
        this._interpreter = new AstDebuggableInterpreter(StdLib);
        this._resolver = new ScopeResolver(this._interpreter, this._typeEnv);

        this._tokens = this._lexer.lex();
        this._ast = this._parser.parse(this._tokens);
        this._resolver.resolve(this._ast);
        this._typeChecker.validate(this._ast);
    }

    private async verifyBreakpoints(path: string): Promise<void> {
        // console.log("bangaRuntime: verifyBreakpoints");

		if (this.debug) {
			const bps = this._breakPoints.get(path);
			if (bps) {
				bps.forEach(bp => {
					if (!bp.verified) {
                        bp.verified = true;
                        this.sendEvent('breakpointValidated', bp);
					}
				});
			}
		}
    }

	/**
	 * Start executing the given program.
	 */
	public start = async(program: string, stopOnEntry: boolean): Promise<void> => {
        // console.log('bangaRuntime: start');

        this._sourceFile = program;

		await this.initializeRuntime(program);

		await this.verifyBreakpoints(this._sourceFile);

		if (this.debug && stopOnEntry) {
            const breakpoint = this._ast[0];
            if (breakpoint) {
                this._interpreter
                    ?.debugService.addBreakpointOn(breakpoint);
            }
		}
	};

	/**
	 * Continue execution to the end/beginning.
	 */
	public continue = (reverse: boolean) => {
        // console.log('bangaRuntime: continue');
        this._interpreter?.debugService.continue();
	};

	/**
	 * Step to the next/previous non empty line.
	 */
	public step = (instruction: boolean, reverse: boolean) => {
        // console.log('bangaRuntime: method not implemented: step');
		this.sendEvent('stopOnStep');
	};

	/**
	 * "Step into" for Banga debug means: go to next character
	 */
	public stepIn = (targetId: number | undefined) => {
        this._interpreter?.debugService.stepInto();
		this.sendEvent('stopOnStep');
	};

	/**
	 * "Step out" for Banga debug means: go to previous character
	 */
	public stepOut = () => {
        this._interpreter?.debugService.stepOver();
		this.sendEvent('stopOnStep');
	};

	public getStepInTargets = (frameId: number): IRuntimeStepInTargets[] => {
        console.error("bangaRuntime: Method not implemented: getStepInTargets");
        return [];
	};

	/**
	 * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
	 */
     public stack = (startFrame: number, endFrame: number): IRuntimeStack => {
        // console.log("bangaRuntime: stack");

        const callStack = [...(this._interpreter?.frames ?? [])].reverse();
        callStack.push({ name: '.MAIN', index: -1 });

		const frames: IRuntimeStackFrame[] = [];

        for (let i = startFrame; i < Math.min(endFrame, callStack.length); i++) {

            const stackFrame: IRuntimeStackFrame = {
                index: callStack[i].index ?? i,
                name: `${callStack[i].name}(frameId::${i})`,	// use a word of the line as the stackframe name
                file: this._sourceFile,
                line: this._currentLine,
                column: 0, // callStack[i],
            };

            frames.push(stackFrame);
        }

		return {
			frames,
			count: frames.length,
		};
	};

	/*
	 * Determine possible column breakpoint positions for the given line.
	 * Here we return the start location of words with more than 8 characters.
	 */
	public getBreakpoints = (path: string, line: number): number[] => {
        // console.log("bangaRuntime: getBreakpoints");
        return [0];
	};

	/*
	 * Set breakpoint in file with given line.
	 */
	public setBreakPoint = async (path: string, line: number): Promise<IRuntimeBreakpoint> => {
        // console.log('bangaRuntime: setBreakPoint');

        if (!this._interpreter) {
            this._initializeRuntime(path);
        }

        const node = getFirstNodeAtLine({tokens: this._tokens, ast: this._ast}, line);
        if (node) {
            this._interpreter?.debugService.addBreakpointOn(node);
        }

		const bp: IRuntimeBreakpoint = { verified: false, line, id: this._breakpointId++ };
		let bps = this._breakPoints.get(path);
		if (!bps) {
			bps = new Array<IRuntimeBreakpoint>();
			this._breakPoints.set(path, bps);
		}
		bps.push(bp);

		await this.verifyBreakpoints(path);

		return bp;
	};

	/*
	 * Clear breakpoint in file with given line.
	 */
	public clearBreakPoint = (path: string, line: number): IRuntimeBreakpoint | undefined => {
        // console.log('bangaRuntime: clearBreakPoint');
        const node = getFirstNodeAtLine({tokens: this._tokens, ast: this._ast}, line);
        if (node) {
            this._interpreter?.debugService.breakpoints.delete(node);
        }
		return undefined;
	};

	public clearBreakpoints = (path: string): void => {
        // console.log('bangaRuntime: clearBreakPoints');
		this._breakPoints.delete(path);
        this._interpreter?.debugService.breakpoints.clear();
	};

	public setDataBreakpoint = (address: string, accessType: 'read' | 'write' | 'readWrite'): boolean => {
        console.error("bangaRuntime: Method not implemented: setDataBreakpoint");
		return true;
	};

	public clearAllDataBreakpoints = (): void => {
        console.error("bangaRuntime: Method not implemented: clearAllDataBreakpoints");
	};

	public setExceptionsFilters = (namedException: string | undefined, otherExceptions: boolean): void => {
        console.error("bangaRuntime: Method not implemented: setExceptionsFilters");
	};

	public setInstructionBreakpoint = (address: number): boolean => {
        console.error("bangaRuntime: Method not implemented: setInstructionBreakpoint");
		return false;
	};

	public clearInstructionBreakpoints = (): void => {
        console.error("bangaRuntime: Method not implemented: clearInstructionBreakpoints");
	};

	public getGlobalVariables = async (cancellationToken?: () => boolean ): Promise<IRuntimeVariable[]> => {
        // console.log("bangaRuntime: getGlobalVariables");

		let a: IRuntimeVariable[] = [];

		for (let [name, value] of (this._interpreter?.globals.entries() ?? [])) {
			a.push({ name, value: value });
			if (cancellationToken && cancellationToken()) {
				break;
			}
		}

		return a;
	};

	public getLocalVariables = (): IRuntimeVariable[] => {
        // console.log("bangaRuntime: getLocalVariables");

        const rv: IRuntimeVariable[] = [];
		for (let [name, value] of (this._interpreter?.environment.entries() ?? [])) {
            rv.push({ name, value: value });
		};
        return rv;
	};

	public getLocalVariable = (name: string): IRuntimeVariable | undefined => {
        // console.log("bangaRuntime: getLocalVariable");
		return this._interpreter?.globals.get(name)?.toString();
	};

	/**
	 * Return words of the given address range as "instructions"
	 */
	public disassemble = (address: number, instructionCount: number): any /* RuntimeDisassembledInstruction[] */ => {
        console.error("bangaRuntime: Method not implemented: disassemble");
	};

	private sendEvent = (event: string, ... args: any[]): void => {
		setImmediate(() => {
			this.emit(event, ...args);
		});
	};
}
