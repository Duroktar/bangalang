import type { HindleyMilner, ParserError, Program, SourceReader, Token, TypeCheckError } from '@bangalang/core';

export type SourceDiagnostics = {
    tokens: Token[];
    ast: Program;
    types: string[];
    reader: SourceReader;
    tc: HindleyMilner;
    errors: (ParserError | TypeCheckError)[];
};
