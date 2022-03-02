
export interface FileAccessor {
    readFile(path: string): Promise<string>;
}
