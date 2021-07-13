import type { HindleyMilner, ParserError, Program, SourceReader, Token, TypeCheckError, TypeEnv } from '@bangalang/core';

export type SourceDiagnostics = {
    tokens: Token[];
    ast: Program;
    types: string[];
    reader: SourceReader;
    tc: HindleyMilner;
    typeEnv: TypeEnv;
    errors: (ParserError | TypeCheckError)[];
};
