import { GlobalTypes, HindleyMilner, SourceReader, TokenLexer, TokenParser } from '@bangalang/core';
import type { SourceDiagnostics } from '../types';

export function sourceDiagnosticsProvider(source: string): SourceDiagnostics {

    const reader = new SourceReader(source);

    const lexer = new TokenLexer(reader);
    const tokens = lexer.lex();

    const parser = new TokenParser(tokens, reader);
    const ast = parser.parseProgram();

    const typeChecker = new HindleyMilner(reader, GlobalTypes);
    const types = typeChecker.typecheck(ast);

    const errors = [...parser.errors, ...typeChecker.errors];

    return { tokens, ast, types, reader, errors, tc: typeChecker };
}
