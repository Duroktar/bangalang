import { Environment } from '../interface/Runtime'
import { IdentifierToken } from '../interface/Lexer'

class Env implements Environment {
    constructor(public enclosing?: Environment) {}
    get = (name: string) => {
        if (this.values.has(name))
            return this.values.get(name)

        if (this.enclosing)
            return this.enclosing.get(name)

        throw new Error("(get) Undefined variable '" + name + "'.")
    }
    assign = (name: IdentifierToken, value: any) => {
        if (this.values.has(name.value))
            return this.values.set(name.value, value)

        if (this.enclosing)
            return this.enclosing.assign(name, value)

        throw new Error("(assign) Undefined variable '" + name.value + "'.")
    }
    define = (name: string, value: any) => {
        this.values.set(name, value)
    }
    has = (name: string) => {
        return this.values.has(name)
    }
    getAt = (distance: number, name: string) => {
        try {
            return this.ancestor(distance).values.get(name)
        } catch (err) {
            throw new Error(`[GET_AT] No entry "${name}" at distance ${distance}.`)
        }
    }
    assignAt = (distance: number, name: IdentifierToken, value: any) => {
        try {
            this.ancestor(distance).values.set(name.value, value)
        } catch (err) {
            const {col,line} = name.lineInfo.start
            throw new Error(`[ASSIGN_AT] No entry "${name.value}" at distance: ${distance}. Line ${line}, Col ${col}`)
        }
    }
    clear = () => {
        return this.values.clear()
    }
    entries = () => {
        return this.values.entries()
    }
    ancestor = (distance: number) => {
        let environment: Environment = this
        for (let i = 0; i < distance; i++) {
            environment = environment.enclosing!
        }

        if (!environment)
            throw new Error('No ancestor at distance: ' + distance)

        return environment
    }

    public values: Map<string, any> = new Map()
}

export const createEnvironment: (d?: Environment) => Environment
    = (d?: Environment) => new Env(d)
