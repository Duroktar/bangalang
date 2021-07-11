import { CompletionItem, TextDocumentPositionParams, CompletionItemKind } from 'vscode-languageserver/node';

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
): CompletionItem[] {
	return Object.values(completions);
}

export function completionItemContentProvider(
	item: CompletionItem,
	context?: any,
): CompletionItem {
	const data = {};
	return Object.assign(item, data);
}
