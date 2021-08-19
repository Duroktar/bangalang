import type { Logger } from "../interface/Logger"

export class ConsoleLogger implements Logger {
    log(...args: any[]) {
        console.log(...args)
    }
    warn(...args: any[]) {
        console.warn(...args)
    }
    error(...args: any[]) {
        console.error(...args)
    }
}
