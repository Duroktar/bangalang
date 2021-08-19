// http://www.bergel.eu/download/papers/Berg07d-debugger.pdf

export interface Debugger {
    setBreakpoint: () => void;
    stepInto: () => void;
    stepOver: () => void;
    continue: () => void;
    terminate: () => void;
}
