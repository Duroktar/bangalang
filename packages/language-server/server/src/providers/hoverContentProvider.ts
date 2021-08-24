import { Declaration, findNodeForToken, HindleyMilner, findTokenAtLocation, TokenKind, Typed, TypeOperator, TypeTuple } from '@bangalang/core';
import { HoverParams } from 'vscode-languageserver/node';
import { SourceDiagnostics } from "../types";

const cache = new Map<string, string[]>();

export function hoverContentProvider(params: HoverParams, sourceData: SourceDiagnostics): string[] {
	const line = params.position.line + 1;
	const char = params.position.character + 1;
    const cacheKey = `${params.textDocument.uri}:${line}:${char}`;

    if (cache.has(cacheKey))
        return cache.get(cacheKey)!;

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
		? formatNodeTypeString(node, tc)
		: token
            ? reader.getLineOfSource(token.lineInfo)
            : 'No Info';

    cache.set(cacheKey, [msgContent]);
	return [msgContent];
}

function formatNodeTypeString(node: Typed<Declaration>, tc: HindleyMilner) {
	switch (node.kind) {
		case 'FuncDeclaration': {
            const type = <TypeOperator>node.type;
			const args = node.varargs
                ? tc.typeToString(type.types[0])
                : (type.types[0] as TypeTuple).types
                    .map(o => o.label ? `${o.label}: ${tc.typeToString(o)}` : tc.typeToString(o))
                    .join(', ');

			const returnType = tc.typeToString(type.types[1]);

			return `func ${node.name.value}(${args}): ${returnType}`;
		}
        case 'ReturnStmt':
            return '';
        case 'CallExpr':
            return `${node.toString()}: ${tc.typeToString(node.type)}`;
        case 'LetDeclaration':
            return `let ${node.name.value}: ${tc.typeToString(node.type)}`;
        case 'CaseExpr':
            return `case (${tc.typeToString((<Typed<Declaration>>node.expr).type)}) -> ${tc.typeToString(node.type)}`;
		default:
			return `${node.toString()}: ${tc.typeToString(node.type)}`;
	}
}
