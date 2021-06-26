import type { LiteralExpr, BinaryExpr } from "./Parser"

export interface Visitor {
    visitLiteralExpr(node: LiteralExpr): any
    visitBinaryExpr(node: BinaryExpr): any
}

export interface Visitable {
    accept(visitor: Visitor): any
}
