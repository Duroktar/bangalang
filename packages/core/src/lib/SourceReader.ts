import type { Range } from "../Lexer";
import type { Reader } from "../Reader";

export class SourceReader implements Reader {
    constructor(public source: string, public srcpath = '') {
        this.cursor = 0;
        this.lineNo = 1;
        this.columnNo = 1;
        this.srcLines = this.source.split('\n');
    }

    next() {
        this.columnNo++;
        return this.source[this.cursor++];
    }

    peek() {
        return this.source[this.cursor];
    }

    peekAhead() {
        return this.source[this.cursor + 1];
    }

    previous() {
        return this.source[this.cursor - 1];
    }

    incrementLineNo() {
        this.columnNo = 0;
        return ++this.lineNo;
    }

    getLineOfSource(range: Range) {
        return this.srcLines[range.start.line - 1]
    }

    get atEOF() {
        return this.cursor >= this.source.length;
    }

    public columnNo: number;
    public lineNo: number;

    private cursor: number;
    private srcLines: string[];
}
