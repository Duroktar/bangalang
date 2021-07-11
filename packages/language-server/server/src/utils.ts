import { Position, Range } from '@bangalang/core';

export function vscodeRange(lineInfo: Range) {
	return {
		start: vscodePostion(lineInfo.start),
		end: vscodePostion(lineInfo.end)
	};
}

export function vscodePostion(position: Position) {
	const line = position.line - 1;
	const col = position.col - 1;
	return { line, character: col };
}
