
export interface Logger {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
}
