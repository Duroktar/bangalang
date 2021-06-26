
export interface Reader {
    next(): string
    peek(): string
    peekAhead(): string
    atEOF: boolean
}
