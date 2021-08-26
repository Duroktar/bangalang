import { Environment } from "./Runtime";
import { Visitor } from "./Visitor";

export interface Interpreter extends Visitor {
    resolve(expr: any, scope: number): any;
    interpret(program: any): any;
    executeBlock(stmts: any[], env: any): any;
    globals: Environment;
    environment: Environment;
}
