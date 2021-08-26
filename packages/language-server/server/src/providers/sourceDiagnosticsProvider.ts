import { AstInterpreter, GlobalTypes, HindleyMilner, ScopeResolver, SourceReader, StdLib, TokenLexer, TokenParser, TypeEnv } from '@bangalang/core';
import type { SourceDiagnostics } from '../types';

export function sourceDiagnosticsProvider(source: string): SourceDiagnostics {

    const reader = new SourceReader(source);
    const lexer = new TokenLexer(reader);
    const parser = new TokenParser(reader);
    const typeEnv = new TypeEnv(GlobalTypes);
    const typeChecker = new HindleyMilner(reader, typeEnv);
    const interpreter = new AstInterpreter(StdLib);
    const resolver = new ScopeResolver(interpreter);

    const tokens = lexer.lex();
    const ast = parser.parse(tokens);

    resolver.resolve(ast);

    const types = typeChecker.validate(ast);

    const errors = [...parser.errors, ...resolver.errors, ...typeChecker.errors];

    return { tokens, ast, types, reader, errors, typeEnv, tc: typeChecker };
}
