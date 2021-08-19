import type { BangalangLanguageServerSettings } from "../types";

// Global settings, used when the `workspace/configuration` request is not supported by the client.
export const defaultSettings: BangalangLanguageServerSettings = { maxNumberOfProblems: 1000 };
