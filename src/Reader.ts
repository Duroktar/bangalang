import type { Range } from "./Lexer";

export interface Reader {
    srcpath: string
    source: string
    next(): string
    peek(): string
    peekAhead(): string
    getLineOfSource(range: Range): string
    columnNo: number
    lineNo: number
    incrementLineNo(): number
    atEOF: boolean
}
