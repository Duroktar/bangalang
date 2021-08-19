import { GlobalTypes, HindleyMilner, SourceReader, TokenLexer, TokenParser, TypeEnv } from '@bangalang/core';
import type { SourceDiagnostics } from '../types';

export function sourceDiagnosticsProvider(source: string): SourceDiagnostics {

    const reader = new SourceReader(source);

    const lexer = new TokenLexer(reader);
    const tokens = lexer.lex();

    const parser = new TokenParser(reader);
    const ast = parser.parse(tokens);

    const typeEnv = new TypeEnv(GlobalTypes);
    const typeChecker = new HindleyMilner(reader, typeEnv);

    const types = typeChecker.validate(ast);

    const errors = [...parser.errors, ...typeChecker.errors];

    return { tokens, ast, types, reader, errors, typeEnv, tc: typeChecker };
}
