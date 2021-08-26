import { findNodeForToken, findTokenAtLocation, TokenKind } from '@bangalang/core';
import { HoverParams } from 'vscode-languageserver/node';
import { SourceDiagnostics } from "../types";

export function hoverContentProvider(params: HoverParams, sourceData: SourceDiagnostics): string[] {
	const line = params.position.line + 1;
	const char = params.position.character + 1;

	const { ast, reader, tc } = sourceData;

	const token = findTokenAtLocation(sourceData, line, char);

    if (token && (
           token.kind === TokenKind.STRING
        || token.kind === TokenKind.NUMBER
        || token.kind === TokenKind.TRUE
        || token.kind === TokenKind.FALSE
    )) {
        return [];
    }

	const node = token
		? findNodeForToken(ast, token)
		: null;

	const msgContent = (node && node.type)
		? tc.nodeTypeToString(node)
		: token
            ? reader.getLineOfSource(token.lineInfo)
            : 'No Info';

	return [msgContent];
}
