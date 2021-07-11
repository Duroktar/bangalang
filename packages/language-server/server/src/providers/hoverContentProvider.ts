import { HoverParams } from 'vscode-languageserver/node';
import { findNodeForToken } from "../query";
import { SourceDiagnostics } from "../types";

export function hoverContentProvider(params: HoverParams, sourceData: SourceDiagnostics): string[] {
	const line = params.position.line + 1;
	const char = params.position.character + 1;

	const tokens = sourceData.tokens.filter(t => t.lineInfo.start.line === line
		&&
		(t.lineInfo.start.col <= char && char <= t.lineInfo.end.col)
	)
		.sort((a, b) => (
			(char - a.lineInfo.start.col) + (a.lineInfo.end.col - char))
			-
			((char - b.lineInfo.start.col) + (b.lineInfo.end.col - char))
		);

	const token = tokens[0];

	const node = token
		? findNodeForToken(sourceData.ast, token)
		: null;

	const msgContent = (token && node && node.type)
		? `${node.toString()}: ${node.type.name}`
		: sourceData.reader.getLineOfSource(token!.lineInfo);

	return [msgContent];
}
