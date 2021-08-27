import { boolType, FunctionArgs, FunctionType, intType, neverType, strType, TyVar } from "./HindleyMilner";

export type TsType =
    | TsTypeAtom
    | TsFuncType

export type TsTypeAtom =
    | 'string'
    | 'number'
    | 'boolean';

export type TsFuncType = {
    args: TsTypeField[];
    ret: TsTypeAtom;
};

type TsTypeField = {
    name: string;
    type: TsTypeAtom;
    isVarArg: boolean;
    isArray: boolean;
}

export class TsTypeParser {
    public parse(src: string, ignoreErrors = true): TsType | null {
        src = src.replace(/\s/g, '');
        if (src.includes('import('))
            return null
        try {
            return this._parse(src)
        } catch (err) {
            if (ignoreErrors) return null
            throw err
        }
    }

    private _parse(src: string): TsType {
        if (src[0] === '(') {
            return this.parseFunctionDef(src.slice(1));
        }
        return this.parseAtom(src);
    }

    private parseFunctionDef(src: string, args: TsTypeField[] = []): TsFuncType {
        const hasArrow = src.includes('=>')
        const hasColon = src.includes(':')
        const hasComma = src.includes(',')
        const arrow = src.lastIndexOf('=>')
        const close = src.indexOf(')')
        const colon = src.indexOf(':')
        const comma = src.indexOf(',')

        if (hasColon) {
            args.push({
                ...this.parseArgName(src, colon),
                ...this.parseArgType(src, colon, hasComma ? comma : close),
            })
            const remainder = src.slice(hasComma ? comma + 1 : arrow + 2)
            return this.parseFunctionDef(remainder, args)
        } else {
            const remainder = src.slice(hasArrow ? arrow + 2 : 0)
            return { args, ret: this.parseAtom(remainder) }
        }
    }

    private parseArgType(src: string, colon: number, end: number) {
        let rest = src.slice(colon + 1, end).trim();
        let isArray = false;
        if (rest.endsWith('[]')) {
            rest = rest.slice(0, -2) as TsTypeAtom;
            isArray = true;
        }
        return {type: this.parseAtom(rest), isArray};
    }

    private parseArgName(src: string, end: number) {
        let name = src.slice(0, end);
        switch (name.split(' ')[0]) {
            case 'readonly':
                name = name.split(' ')[1]
            default: break
        }
        if (name.endsWith('?')) {
            throw new Error("Unsupported: optional")
        }
        if (name.startsWith('...')) {
            name = name.slice(3)
            return {name, isVarArg: true}
        }
        return {name, isVarArg: false}
    }

    private parseAtom(type: string) {
        if (this.isAtom(type))
            return type
        throw new Error("Bad Atom -> " + type)
    }

    private isAtom(type: string): type is TsTypeAtom {
        switch (type) {
            case 'string':
            case 'number':
            case 'boolean':
            case 'void':
                return true;
            default:
                return false
        }
    }

    public stringify(rt: TsType, labels = true): string {
        switch (rt) {
            case 'string':
            case 'number':
            case 'boolean':
            case 'void':
                return rt
            default: {
                const args = labels
                    ? rt.args.map(a => `${a.isVarArg ? '...' : ''}${a.name}: ${a.type}`)
                    : rt.args.map(a => `${a.isVarArg ? '...' : ''}${a.type}`);

                return `(${args.join(', ')}) => ${rt.ret}`
            }
        }
    }

    public toBangaType(rt: TsType): TyVar {
        switch (rt) {
            case 'string': return strType();
            case 'number': return intType();
            case 'boolean': return boolType();
            case 'void': return neverType();
            default: {
                const args = rt.args.map(arg => this.toBangaType(arg.type));
                return FunctionType(FunctionArgs(args, rt.args.some(o => o.isVarArg)), this.toBangaType(rt.ret))
            }
        }
    }
}

export const runTests = () => {
    const tests = [
        'string',
        'number',
        'boolean',
        '(p: string) => string',
        '(p: string) => boolean',
        '(...paths: string[]) => string',
        '(from: string, to: string) => string',
        '(path: string) => string',
        '(p: string) => string',
        '(p: string, ext?: string) => string',
        '(p: string) => string',
        '(pP: import("path").FormatInputPathObject) => string',
        '(p: string) => import("path").ParsedPath',
    ]

    const parser = new TsTypeParser()
    tests.forEach(t => {
        const result = parser.parse(t.trim())
        result && console.log(parser.stringify(result))
    })
}
