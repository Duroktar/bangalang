import type * as Ast from "./Ast";

export interface Visitor {
    visitExpressionStmt(node: Ast.ExpressionStmt): any
    visitLetDeclaration(node: Ast.LetDeclaration): any
    visitGroupingExpr(node: Ast.GroupingExpr): any
    visitLiteralExpr(node: Ast.LiteralExpr): any
    visitVariableExpr(node: Ast.VariableExpr): any
    visitAssignExpr(node: Ast.AssignExpr): any
    visitBinaryExpr(node: Ast.BinaryExpr): any
}

export interface Visitable {
    accept(visitor: Visitor): any
}
