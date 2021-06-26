import { readFileSync } from "fs";
import type { Reader } from "../Reader";

export class FileReader implements Reader {
    constructor(public srcFile: string) {
        this.source = readFileSync(srcFile).toString();
        this.cursor = 0;
    }

    next() {
        return this.source[this.cursor++];
    }

    peek() {
        return this.source[this.cursor];
    }

    peekAhead() {
        return this.source[this.cursor + 1];
    }

    get atEOF() {
        return this.cursor >= this.source.length;
    }

    private source: string;
    private cursor: number;
}
