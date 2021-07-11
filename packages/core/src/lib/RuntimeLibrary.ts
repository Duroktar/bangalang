import { BangaCallable } from '../Runtime'
import { AstInterpreter } from './AstInterpreter'

export class BangaPrintFunction implements BangaCallable {
    checkArity(n: number): boolean {
        return true
    }
    arity() {
        return '...'
    }
    call(v: AstInterpreter, args: object[]) {
        console.log(...args)
        return args.length
    }
    toString(): string {
        return `print/${this.arity()}`
    }
}

export const StdLib = {
    print: new BangaPrintFunction()
}
