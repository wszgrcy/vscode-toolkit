import { Webview } from 'vscode';

export interface CreateContextOptions {
  [name: string]: any;
  webview: Webview;
}
