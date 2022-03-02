/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { activateBangaDebug } from '../activateBangaDebug';

export function activate(context: vscode.ExtensionContext) {
	activateBangaDebug(context);
}

export function deactivate() {
	// nothing to do
}
