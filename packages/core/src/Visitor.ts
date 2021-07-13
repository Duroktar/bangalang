import type * as Ast from "./Ast";
import { Printable } from "./Logger";

export interface Visitor {
    visitExpressionStmt(node: Ast.ExpressionStmt): any
    visitFuncDeclaration(node: Ast.FuncDeclaration): any;
    visitLetDeclaration(node: Ast.LetDeclaration): any
    visitBlockStmt(node: Ast.BlockStmt): any;
    visitGroupingExpr(node: Ast.GroupingExpr): any
    visitLiteralExpr(node: Ast.LiteralExpr): any
    visitVariableExpr(node: Ast.VariableExpr): any
    visitAssignExpr(node: Ast.AssignExpr): any
    visitBinaryExpr(node: Ast.BinaryExpr): any
    visitCallExpr(node: Ast.CallExpr): any
}

export interface Visitable extends Printable {
    accept(visitor: Visitor): any
}
