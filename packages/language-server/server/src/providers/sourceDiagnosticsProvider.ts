import { GlobalTypes, HindleyMilner, SourceReader, TokenLexer, TokenParser, TypeEnv } from '@bangalang/core';
import type { SourceDiagnostics } from '../types';

export function sourceDiagnosticsProvider(source: string): SourceDiagnostics {

    const reader = new SourceReader(source);

    const lexer = new TokenLexer(reader);
    const tokens = lexer.lex();

    const parser = new TokenParser(tokens, reader);
    const ast = parser.parseProgram();

    const typeChecker = new HindleyMilner(reader);

    const typeEnv = new TypeEnv(typeChecker, GlobalTypes);
    const types = typeChecker.typecheck(ast, typeEnv);

    const errors = [...parser.errors, ...typeChecker.errors];

    return { tokens, ast, types, reader, errors, typeEnv, tc: typeChecker };
}
