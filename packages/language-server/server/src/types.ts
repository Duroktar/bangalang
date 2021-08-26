import type { HindleyMilner, Interpreter, ParserError, Program, SourceReader, Token, TypeCheckError, TypeEnv } from '@bangalang/core';
import type { TextDocumentPositionParams, CompletionItem, HoverParams } from 'vscode-languageserver';

export type SourceDiagnostics = {
    tokens: Token[];
    ast: Program;
    types: string[];
    reader: SourceReader;
    tc: HindleyMilner;
    interpreter: Interpreter;
    typeEnv: TypeEnv;
    errors: (ParserError | TypeCheckError)[];
};


export interface BangalangLanguageServerSettings {
    maxNumberOfProblems: number;
}


export type ServerSettings = {
    hasConfigurationCapability: boolean;
    hasWorkspaceFolderCapability: boolean;
    hasDiagnosticRelatedInformationCapability: boolean;

    global: BangalangLanguageServerSettings;
    document: Map<string, Thenable<BangalangLanguageServerSettings>>;
}

export type Providers = {
    completionContentProvider(params: TextDocumentPositionParams, sourceData: SourceDiagnostics): CompletionItem[]
    completionItemContentProvider(item: CompletionItem, sourceData: SourceDiagnostics): CompletionItem
    hoverContentProvider(params: HoverParams, sourceData: SourceDiagnostics): string[]
    sourceDiagnosticsProvider(source: string): SourceDiagnostics
}
