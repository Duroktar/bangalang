import { Visitor } from "./Visitor";

export interface Interpreter extends Visitor {
    execute(program: any): any;
    executeBlock(stmts: any, env: any): any;
}
