/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, languages } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		// path.join('server', 'out', 'server.js')
		path.join('dist', 'server.js')
	);

    console.log('serverModule ------->', serverModule);

	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		},
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: 'file', language: 'bangalang' },
			{ pattern: '*.bl' },
		],
		synchronize: {
			// Notify the server about file changes to '.bangarc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.bangarc'),
		},
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'bangalangLanguageServer',
		'Bangalang Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
