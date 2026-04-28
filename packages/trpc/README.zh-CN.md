# @cyia/vscode-trpc

<div align="center">

🌐 [English](./README.md) | [中文](README.zh-CN.md)

</div>

为 VS Code 扩展与 Webview 通信提供的 tRPC 集成，实现类型安全的过程调用。

## 特性

- **类型安全的 IPC**: 利用 tRPC 的端到端类型安全特性
- **IPC Link**: 基于 VS Code postMessage API 的自定义传输层
- **压缩支持**: 内置 snappyjs 消息压缩，提升传输效率
- **订阅支持**: 支持从扩展到 Webview 的实时订阅
- **上下文注入**: 灵活的上下文创建，可访问 webview 实例

## 安装

```bash
npm install @cyia/vscode-trpc
# 或
pnpm add @cyia/vscode-trpc
```

## 使用示例

### 服务端（扩展主机）

```typescript
import { createIPCHandler } from '@cyia/vscode-trpc/server';
import { initTRPC } from '@trpc/server';
import * as v from 'valibot';

const t = initTRPC.create();

const appRouter = t.router({
  greet: t.procedure
    .input(v.object({ name: v.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),
});

type AppRouter = typeof appRouter;

// 创建 IPC Handler
const ipcHandler = createIPCHandler<AppRouter>({
  router: appRouter,
  createContext: async ({ webview }) => ({
    // 你的上下文
  }),
});

// 注册 Webview
const panel = vscode.window.createWebviewPanel(...);
ipcHandler.addWebView(panel.webview);

// 监听销毁事件
panel.onDidDispose(() => {
  ipcHandler.removeWebView(panel.webview);
});
```

### 客户端（Webview）

```typescript
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from '@cyia/vscode-trpc/client';
import type { AppRouter } from '../extension'; // 共享类型

const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

// 调用过程
const result = await trpc.greet.query({ name: 'World' });
console.log(result); // "Hello, World!"
```

## API 参考

### 服务端

#### `createIPCHandler<TRouter>(options)`

创建用于在扩展主机中管理 tRPC 过程的 IPC Handler。

**方法：**

- `addWebView(webview, extraContext?, compressPathObj?)` - 注册 Webview 处理 tRPC 请求
- `removeWebView(webview)` - 注销并清理 Webview

#### `CreateContextOptions`

```typescript
interface CreateContextOptions {
  webview: Webview;
  [name: string]: any;
}
```

### 客户端

#### `ipcLink<TRouter>(options?)`

返回一个通过 VS Code postMessage API 与扩展主机通信的 tRPC Link。

## 压缩

支持使用 snappyjs 压缩消息以减少传输大小：

```typescript
// 客户端 - 压缩输入
await trpc.largeProcedure.mutate(data, {
  context: { compress: true },
});

// 服务端 - 压缩特定过程响应
ipcHandler.addWebView(webview, undefined, {
  'largeProcedure': true,
});
```

