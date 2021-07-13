import { CompletionItem, TextDocumentPositionParams, CompletionItemKind } from 'vscode-languageserver/node';
import { HindleyMilner } from '@bangalang/core';
import { SourceDiagnostics } from '../types';

export const completions: Record<string, CompletionItem> = {
	let: {
		label: 'let',
		kind: CompletionItemKind.Keyword,
		data: 'let',
		detail: 'A `let` variable binding statement.',
		documentation: 'http://github.com/duroktar/bangalang/docs/language/spec.html#variables-let',
	}
};

export function completionContentProvider(
	params: TextDocumentPositionParams,
	sourceData: SourceDiagnostics,
): CompletionItem[] {
	const fromTypeEnv = Object.entries(sourceData.typeEnv.map).map(([key, value]) => ({
		label: key,
		kind: CompletionItemKind.Variable,
		data: key,
		detail: `${key}: ${sourceData.tc.typeToString(value)}`
	}));
	return Object.values(completions).concat(fromTypeEnv);
}

export function completionItemContentProvider(
	item: CompletionItem,
	sourceData: SourceDiagnostics,
): CompletionItem {
	const data = {};
	return Object.assign(item, data);
}
