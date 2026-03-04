/**
 * Shared accessor for the VS Code webview API instance.
 *
 * Initialised once during app startup via `initVscodeApi()`.
 * All modules that need to post messages can import `getVscode()`.
 */
import type { VsCodeApi } from './types';

let _vscode: VsCodeApi | null = null;

export function initVscodeApi(api: VsCodeApi): void {
  _vscode = api;
}

export function getVscode(): VsCodeApi {
  if (!_vscode) {
    throw new Error('vscode API not initialised — call initVscodeApi() first');
  }
  return _vscode;
}
