/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	HoverParams,
	HandlerResult,
	Hover,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, Range } from '@bangalang/core';
import { debounce } from 'debounce';
import { findNode, getSourceData } from './checker';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			// Tell the client that this server supports hover completion.
			hoverProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

const validateTextDocumentDebounced = debounce(validateTextDocument, 200, true);

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocumentDebounced(change.document);
});

let sourceData: ReturnType<typeof getSourceData>;

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	sourceData = getSourceData(textDocument.getText());
	await transmitDocumentErrorData(textDocument);
}

async function transmitDocumentErrorData(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	for (const error of sourceData.errors) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: vscodeRange(error.token.lineInfo),
			message: error.message,
			source: 'bangalang'
		};
		diagnostics.push(diagnostic);
		if (problems >= settings.maxNumberOfProblems)
			break;
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		connection.console.log('onCompletion');
		// The pass parameter contains the position of the text document in
		// which code complete got requested.
		return [
			// {
			// 	label: 'TypeScript',
			// 	kind: CompletionItemKind.Text,
			// 	data: 1
			// },
			// {
			// 	label: 'JavaScript',
			// 	kind: CompletionItemKind.Text,
			// 	data: 2
			// }
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		connection.console.log('onCompletionResolve');
		// if (item.data === 1) {
		// 	item.detail = 'TypeScript details';
		// 	item.documentation = 'TypeScript documentation';
		// } else if (item.data === 2) {
		// 	item.detail = 'JavaScript details';
		// 	item.documentation = 'JavaScript documentation';
		// }
		return item;
	}
);

connection.onHover(
	(params: HoverParams): HandlerResult<Hover, void> => {
		const line = params.position.line + 1;
		const char = params.position.character + 1;

		const tokens = sourceData.tokens.filter(t =>
			t.lineInfo.start.line === line
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
			? findNode(sourceData.ast, token)
			: null;

		const msgContent = (token && node && node.type)
			? `${node.toString()}: ${node.type.name}`
			: sourceData.reader.getLineOfSource(token!.lineInfo);

		return {
			contents: [msgContent]
		};
	}
);	

function vscodeRange(lineInfo: Range) {
    return {
        start: vscodePostion(lineInfo.start),
        end: vscodePostion(lineInfo.end)
    };
}

function vscodePostion(position: Position) {
    const line = position.line - 1;
    const col = position.col - 1;
    return { line, character: col };
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
