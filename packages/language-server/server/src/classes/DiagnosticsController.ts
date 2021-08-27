import * as LS from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { debounce } from 'debounce';
import type * as T from '../types';
import { vscodeRange } from '../utils';
import { defaultSettings } from './DefaultSettings';

interface IDiagnosticsController {
    initializeProviders: () => this
}

export class DiagnosticsController implements IDiagnosticsController {
    constructor(
        private documents: LS.TextDocuments<TextDocument>,
        private connection: LS.Connection,
        private providers: T.Providers,
        private settings: T.ServerSettings,
    ) {}

    public initializeProviders = () => {
        // This handler provides the initial list of the completion items.
        this.connection.onCompletion(
            (params: LS.TextDocumentPositionParams): LS.CompletionItem[] => {
                // this.connection.console.log('onCompletion');
                // The passed parameters contain the position in the text
                // document for which the code completion got requested.
                return this.providers.completionContentProvider(params, this.sourceData);
            }
        );

        // This handler resolves additional information for the item selected in
        // the completion list.
        this.connection.onCompletionResolve(
            (item: LS.CompletionItem): LS.CompletionItem => {
                return this.providers.completionItemContentProvider(item, this.sourceData);
            }
        );

        this.connection.onHover(
            (params: LS.HoverParams): LS.HandlerResult<LS.Hover, void> => {
                return { contents: this.providers.hoverContentProvider(params, this.sourceData) };
            }
        );

        this.connection.onDidChangeConfiguration(change => {
            if (this.settings.hasConfigurationCapability) {
                // Reset all cached document settings
                this.settings.document.clear();
            } else {
                this.settings.global = <T.BangalangLanguageServerSettings>(
                    (change.settings.languageServerExample || defaultSettings)
                );
            }

            // Revalidate all open text documents
            this.documents.all().forEach(this.validateTextDocumentDebounced);
        });

        this.connection.onDidChangeWatchedFiles(event => {
            // Monitored files have change in VSCode
            this.connection.console.log('We received an file change event');
        });

        // The content of a text document has changed. This event is emitted
        // when the text document first opened or when its content has changed.
        this.documents.onDidChangeContent(change => {
            this.validateTextDocumentDebounced(change.document);
        });

        return this;
    };

    private validateTextDocument = async (doc: TextDocument): Promise<void> => {
        this.sourceData = this.providers.sourceDiagnosticsProvider(doc.getText());
        await this.collectAndSendDiagnostics(doc);
    };

    private validateTextDocumentDebounced = debounce(this.validateTextDocument, 200, true);

    private getDocumentSettings = (resource: string): Thenable<T.BangalangLanguageServerSettings> => {
        if (!this.settings.hasConfigurationCapability) {
            return Promise.resolve(this.settings.global);
        }
        let result = this.settings.document.get(resource);
        if (!result) {
            result = this.connection.workspace.getConfiguration({
                scopeUri: resource,
                section: 'languageServerExample'
            });
            this.settings.document.set(resource, result);
        }
        return result;
    };

    private collectAndSendDiagnostics = async (doc: TextDocument): Promise<void> => {
        const settings = await this.getDocumentSettings(doc.uri);

        let problems = 0;
        const diagnostics: LS.Diagnostic[] = [];
        for (const error of this.sourceData.errors) {
            problems++;
            const diagnostic: LS.Diagnostic = {
                severity: LS.DiagnosticSeverity.Warning,
                range: vscodeRange(error.range ?? error.token.lineInfo),
                message: error.message,
                source: doc.uri,
            };
            diagnostics.push(diagnostic);
            if (problems >= settings.maxNumberOfProblems)
                break;
        }

        // Send the computed diagnostics to VSCode.
        this.connection.sendDiagnostics({ uri: doc.uri, diagnostics });
    };

    private sourceData!: T.SourceDiagnostics;
}
