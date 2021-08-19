import type { Range, TokenKind, TokenOf } from "../interface/Lexer";

export const UNREACHABLE = (n: never, e?: any) => { if (e) throw e; return n; }

export function format(fmt: string, ...args: any) {
    if (!fmt.match(/^(?:(?:(?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{[0-9]+\}))+$/)) {
        throw new Error('invalid format string.');
    }
    return fmt.replace(/((?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{([0-9]+)\})/g, (m, str, index) => {
        if (str) {
            return str.replace(/(?:{{)|(?:}})/g, (m: string) => m[0]);
        } else {
            if (index >= args.length) {
                throw new Error('argument index is out of range in format');
            }
            return args[index];
        }
    });
}

export const print = (fmt: string, ...args: any) => console.log(format(fmt, ...args))

export const capitalize = (s: string) => (s[0] ?? '').toUpperCase() + (s.slice(1) ?? '')

export function underline(range: Range, leftMargin = 0) {
    const numArrows = Math.abs(range.end.col - range.start.col)
    const space = ' '.repeat(clamp(0, Infinity, range.start.col - 1 + leftMargin))
    const arrows = '^'.repeat(clamp(0, Infinity, numArrows))
    return space + arrows
}

export class StringBuilder {
    addLine(line: string) {
        this.lines.push(line)
        return this
    }
    addText(text: string) {
        let line = this.lines.pop() ?? ''
        this.lines.push(line + text)
        return this
    }
    build() {
        return this.lines.join('\n')
    }
    private lines: string[] = []
}

export const clamp: (min: number, max: number, num: number) => number
    = (min, max, num) => Math.max(min, Math.min(max, num))

export const zip = <A, B>(a:A[], b:B[]): [A, B][] => a.map((k, i) => [k, b[i]]);

export const is = <T>(o: unknown): o is T => o as any;
export const isKind = <T extends TokenKind>(t: T, o: {kind: unknown}): o is TokenOf<T> => o.kind === t;
