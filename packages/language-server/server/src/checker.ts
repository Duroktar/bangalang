import { AssignExpr, BinaryExpr, ConsoleLogger, ConsoleReporter, ExpressionStmt, GroupingExpr, HindleyMilner, LetDeclaration, LiteralExpr, Program, SourceReader, Statement, Token, TokenLexer, TokenParser, Typed, VariableExpr, Visitor } from '@bangalang/core';

export function getSourceData(source: string) {

    const reader = new SourceReader(source);
    const output = new ConsoleLogger();

    // TODO: vscode error reporter
    const reporter = new ConsoleReporter(reader, output);

    const lexer = new TokenLexer(reader);
    const tokens = lexer.lex();

    const parser = new TokenParser(tokens, reader);
    const ast = parser.parseProgram();

    const typeChecker = new HindleyMilner(reader);

    const types = typeChecker.typecheck(ast);

    const errors = [...parser.errors, ...typeChecker.errors];

    return { tokens, ast, types, reader, reporter, errors };
}

class QueryVisitor implements Visitor {
    constructor(public target: Token) {}

    query(stmt: Statement): Typed<Statement> | null {
        return stmt?.accept(this);
    }

    visitExpressionStmt(node: ExpressionStmt): any {
        if (node.token === this.target) {
            return node;
        }
        return node.expr?.accept(this);
    }
    visitLetDeclaration(node: LetDeclaration): any {
        if (node.name === this.target) {
            return node;
        }
        return node.init?.accept(this);
    }
    visitGroupingExpr(node: GroupingExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return node.expr?.accept(this);
    }
    visitLiteralExpr(node: LiteralExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return null;
    }
    visitVariableExpr(node: VariableExpr): any {
        if (node.token === this.target) {
            return node;
        }
        return null;
    }
    visitAssignExpr(node: AssignExpr): any {
        if (node.name === this.target) {
            return node;
        }
        return node.value?.accept(this);
    }
    visitBinaryExpr(node: BinaryExpr): any {
        if (node.op === this.target) {
            return node;
        }
        const left = node.left?.accept(this);
        const right = node.right?.accept(this);
        return left ?? right;
    }
}

export function findNode(program: Program, token: Token) {
    const visitor = new QueryVisitor(token);
    for (const node of program) {
        if (node === null) continue;
        const res = visitor.query(node);
        if (res !== null) return res;
    }
    return null;
}
