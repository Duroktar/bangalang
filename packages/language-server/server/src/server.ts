/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticsController } from './classes/DiagnosticsController';
import { defaultSettings } from './classes/DefaultSettings';
import { completionContentProvider, completionItemContentProvider} from './providers/completionContentProvider';
import { hoverContentProvider } from './providers/hoverContentProvider';
import { sourceDiagnosticsProvider } from './providers/sourceDiagnosticsProvider';
import type { Providers, ServerSettings } from './types';

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

const settings: ServerSettings = {
    hasConfigurationCapability: false,
    hasWorkspaceFolderCapability: false,
    hasDiagnosticRelatedInformationCapability: false,
    global: defaultSettings,
    document: new Map(),
};

const providers: Providers = {
    completionContentProvider,
    completionItemContentProvider,
    hoverContentProvider,
    sourceDiagnosticsProvider,
};

const diagnostics = new DiagnosticsController(
    documents,
    connection,
    providers,
    settings,
);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// Start off the Diagnostics Controller.
diagnostics.initializeProviders();

// Connections for workplace settings and capabilities.
connection.onInitialize(params => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	settings.hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	settings.hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	settings.hasDiagnosticRelatedInformationCapability = !!(
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

	if (settings.hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}

	return result;
});

connection.onInitialized(() => {
	if (settings.hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (settings.hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// Only keep settings for open documents
documents.onDidClose(e => settings.document.delete(e.document.uri));

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
