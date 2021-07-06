import { yellow, red, yellowBright, cyan, bold } from "chalk";
import { relative } from "path";
import type * as Ast from "../Ast";
import type { Reader } from "../Reader";
import type { WithType } from "../Types";
import { lineInfo, underline } from "./ConsoleReporter";

export const UNREACHABLE = (n: never) => n

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

export const zip = <A, B>(a:A[], b:B[]) => a.map((k, i) => [k, b[i]]);

export const formatTypeError = (
    reader: Reader,
    expr1: WithType<Ast.Expression>,
    expr2: WithType<Ast.Expression>,
    msg?: string,
): string => {
    const lineInfoExpr1 = lineInfo(expr1), lineInfoExpr2 = lineInfo(expr2);
    const columnRange = `${yellow(lineInfoExpr1.start.col)}-${yellow(lineInfoExpr2.end.col)}`
    const redArrows = red(underline(lineInfoExpr1))
    const yellowArrows = yellowBright(underline(lineInfoExpr2, -(lineInfoExpr1.end.col - 1)))
    const filepath = cyan(relative(process.cwd(), reader.srcpath))
    const linerange = `${yellow(lineInfoExpr1.start.line)}:${columnRange}`
    const help = bold(`The type ${yellowBright(expr2.type)} can't be used in place of the type ${red(expr1.type)}`)

    return new StringBuilder()
        .addLine(`${filepath} (${linerange}) - ${red('error')}: ${msg ?? help}`)
        .addLine(' ')
        .addLine('\t' + reader.getLineOfSource(lineInfoExpr1))
        .addLine('\t' + `${redArrows}${yellowArrows}`)
        .addLine(' ')
        .addLine('Hint: ' + help)
        .build()
}
