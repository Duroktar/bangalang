import { HoverParams } from 'vscode-languageserver/node';
import { HindleyMilner, Statement, Typed, TypeOperator } from '@bangalang/core';
import { findNodeForToken } from "../query";
import { SourceDiagnostics } from "../types";

export function hoverContentProvider(params: HoverParams, sourceData: SourceDiagnostics): string[] {
	const line = params.position.line + 1;
	const char = params.position.character + 1;

	const { ast, reader, tc } = sourceData;

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
		? findNodeForToken(ast, token)
		: null;

	const msgContent = (token && node && node.type)
		? formatNodeTypeString(node, tc)
		: token?.lineInfo ? reader.getLineOfSource(token.lineInfo) : '';

	return [msgContent];
}

function formatNodeTypeString(node: Typed<Statement>, tc: HindleyMilner) {
	switch (node.type.name) {
		case '=>': {
			const funcName = node.toString();

			const args = (<TypeOperator>node.type).types
				.slice(0, 1)
				.map(o => o.label ? `${o.label}: ${tc.typeToString(o)}` : tc.typeToString(o))
				.join(', ');

			const returnTypeName = tc.typeToString((<TypeOperator>node.type).types[1]);

			return `func ${funcName}(${args}): ${returnTypeName}`;
		}
		default:
			return `${node.toString()}: ${tc.typeToString(node.type)}`;
	}
}
