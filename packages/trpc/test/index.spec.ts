import * as fs from 'fs';
import * as path from 'path';
import { createIPCHandler } from '../server';
import { AppRouter, appRouter, callInputSubject } from './bootstrap/router';
import * as vscode from 'vscode';
import { firstValueFrom } from 'rxjs';
import { expect } from 'chai';
interface TestConfig {
  path: string;
  input?: any;
}

function getWebviewContent(webview: vscode.Webview, config: TestConfig) {
  const webviewJsPath = path.join(__dirname, '..', 'webview.js');
  const webviewJsContent = fs.readFileSync(webviewJsPath, 'utf-8');

  // 注入全局配置到 webview
  const configScript = `window.__TRPC_TEST_CONFIG__ = ${JSON.stringify(config)};`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TRPC Test</title>
</head>
<body>
  <h1>TRPC Webview Test</h1>
  <div id="result"></div>
  <script>
  ${configScript}
  </script>
  <script>
  ${webviewJsContent}
  </script>
</body>
</html>`;
}

async function createWebView(
  ipcHandler: Awaited<ReturnType<typeof setupIPCHandler>>,
  config: TestConfig,
): Promise<vscode.WebviewPanel> {
  const panel = vscode.window.createWebviewPanel(
    'trpcTest',
    'TRPC Test',
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  // 加载 webview HTML，注入测试配置
  panel.webview.html = getWebviewContent(panel.webview, config);

  // 将 webview 注册到 IPC Handler
  ipcHandler.addWebView(
    panel.webview,
    { ctx1: 'hello' },
    { cmp1: true, 'cmp2.cmp1': true },
  );

  panel.onDidDispose(() => {
    ipcHandler.removeWebView(panel.webview);
  });

  return panel;
}

async function setupIPCHandler() {
  return createIPCHandler<AppRouter>({
    router: appRouter,
    createContext: async (options) => ({
      ...options,
    }),
  });
}

describe('trpc test', () => {
  let ipcHandler: any;

  beforeEach(async () => {
    ipcHandler = await setupIPCHandler();
  });

  afterEach(() => {});

  it('should call hello procedure', async () => {
    const config: TestConfig = {
      path: 'hello',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('hello');
    panel.dispose();
  });

  it('should call input1 procedure with input', async () => {
    const config: TestConfig = {
      path: 'input1',
      input: { a1: 'test-value' },
    };
    const panel = await createWebView(ipcHandler, config);
    const result = await firstValueFrom(callInputSubject);
    expect(result.path).eq('input1');
    expect(result.input).deep.eq({ a1: 'test-value' });
    panel.dispose();
  });
  it('r1.r2', async () => {
    const config: TestConfig = {
      path: 'r1.r2',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('r1.r2');
    panel.dispose();
  });
  it('cmp1', async () => {
    const config: TestConfig = {
      path: 'cmp1',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('cmp1');
    expect(result.value).deep.eq({
      arr1: [1, 2, 3],
      num1: 1,
      str1: '1',
      b1: true,
    });

    panel.dispose();
  });
  it('cmp2.cmp1', async () => {
    const config: TestConfig = {
      path: 'cmp2.cmp1',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('cmp2.cmp1');
    expect(result.value).deep.eq({
      arr1: [1, 2, 3],
      num1: 1,
      str1: '1',
      b1: true,
    });
    panel.dispose();
  });
  it('cmp3', async () => {
    const config: TestConfig = {
      path: 'cmp3',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('cmp3');
    expect(result.value).deep.eq(new Uint8Array([1, 2, 3, 4]));

    panel.dispose();
  });
  it('cmp4.cmp3', async () => {
    const config: TestConfig = {
      path: 'cmp4.cmp3',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('cmp4.cmp3');
    expect(result.value).deep.eq(new Uint8Array([1, 2, 3, 4]));
    panel.dispose();
  });
  it('clientCmp', async () => {
    const config: TestConfig = {
      path: 'clientCmp',
      input: {
        arr1: [1, 2, 3],
        num1: 1,
        str1: '1',
        b1: true,
      },
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('clientCmp');
    expect(result.input).deep.eq({
      arr1: [1, 2, 3],
      num1: 1,
      str1: '1',
      b1: true,
    });

    panel.dispose();
  });
  it('clientCmpUint8', async () => {
    const config: TestConfig = {
      path: 'clientCmpUint8',
    };
    const data = firstValueFrom(callInputSubject);
    const panel = await createWebView(ipcHandler, config);
    const result = await data;
    expect(result.path).eq('clientCmpUint8');
    expect(result.input).deep.eq(new Uint8Array([1, 2, 3, 4]));

    panel.dispose();
  });
});
