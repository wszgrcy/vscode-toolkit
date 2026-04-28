# @cyia/vscode-trpc

<div align="center">

🌐 [English](./README.md) | [中文](README.zh-CN.md)

</div>

为 VS Code 扩展主机与 Webview 之间通信提供的 tRPC 集成，实现端到端类型安全的 RPC 调用。

## 特性

- **类型安全**: 利用 tRPC 的端到端类型安全特性，扩展主机和 Webview 共享 Router 类型定义
- **IPC Link**: 基于 VS Code `postMessage` API 的自定义 tRPC 传输层
- **消息压缩**: 内置 [snappyjs](https://github.com/kubanco/snappyjs) 压缩支持，可按过程路径精细控制哪些接口需要压缩
- **订阅支持**: 支持 tRPC Subscription（Observable / AsyncGenerator），实现实时双向通信
- **灵活上下文**: 通过 `createContext` 注入自定义上下文（如 webview 实例、扩展状态等）

## 安装

```bash
npm install @cyia/vscode-trpc
# 或
pnpm add @cyia/vscode-trpc
```

> **依赖**: 本包需要 `@trpc/server` 和 `@trpc/client` 作为 peer 依赖。

## 导出

| 导入路径                   | 说明                           |
| -------------------------- | ------------------------------ |
| `@cyia/vscode-trpc/server` | 服务端工具：`createIPCHandler` |
| `@cyia/vscode-trpc/client` | 客户端工具：`ipcLink`          |

---

## 快速开始

### 1. 定义 Router

首先在与扩展主机和 Webview 共用的代码中定义 tRPC Router：

```typescript
import { initTRPC } from '@trpc/server';
import * as v from 'valibot';

const t = initTRPC.create();

export const appRouter = t.router({
  // 简单查询
  hello: t.procedure.query(() => 'Hello World'),

  // 带输入校验的查询
  getUser: t.procedure
    .input(v.object({ id: v.string() }))
    .query(({ input }) => ({ name: 'Alice', id: input.id })),

  // 嵌套路由
  posts: t.router({
    list: t.procedure.query(() => [{ id: 1, title: 'First Post' }]),
  }),
});

export type AppRouter = typeof appRouter;
```

> Router 定义文件应位于扩展主机和 Webview 共享的模块中，以确保 TypeScript 类型端到端推断。

### 2. 扩展主机端 —— 注册 IPC Handler

```typescript
import { Disposable } from 'vscode';
import { createIPCHandler } from '@cyia/vscode-trpc/server';
import { appRouter, AppRouter } from './shared/router';

// 创建 IPC Handler
const ipcHandler = createIPCHandler<AppRouter>({
  router: appRouter,

  // 可选：自定义上下文，可访问 webview 实例
  createContext: async (options) => ({
    ...options,
  }),
});

// 在激活扩展时，将 Webview 注册到 Handler
function registerWebviewPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'myPanel',
    'My Panel',
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  // 注册 webview（自动绑定消息监听）
  ipcHandler.addWebView(panel.webview);

  // 也可传入额外上下文和压缩配置
  // ipcHandler.addWebView(panel.webview, { userId: '123' }, { 'posts.list': true });

  panel.onDidDispose(() => {
    // 面板关闭时移除注册，清理订阅
    ipcHandler.removeWebView(panel.webview);
  });

  return panel;
}
```

### 3. Webview 端 —— 创建 tRPC 客户端

```typescript
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from '@cyia/vscode-trpc/client';
import type { AppRouter } from '../shared/router';

// 在 Webview 中创建客户端
const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

// 调用查询
async function loadHello() {
  const result = await trpc.hello.query();
  console.log(result); // 'Hello World'
}

// 带输入的查询
async function loadUser() {
  const user = await trpc.getUser.query({ id: '42' });
  console.log(user.name); // 'Alice'
}

// 嵌套路由调用
const posts = await trpc.posts.list.query();
```

### 4. 订阅实时数据

```typescript
// 在扩展主机的 Router 中定义 Subscription
const appRouter = t.router({
  counter: t.procedure.subscription(() => {
    return new Promise((resolve) => {
      let count = 0;
      const interval = setInterval(() => {
        observer.next(count++);
      }, 1000);
      resolve({
        unsubscribe() {
          clearInterval(interval);
        },
      });
    });
  }),
});

// 在 Webview 中订阅
const unsubscribe = trpc.counter.subscribe(undefined, {
  onNext(value) {
    console.log('Count:', value);
  }, // 每秒递增
  onError(error) {
    console.error('Subscription error:', error);
  },
  onCompleted() {
    console.log('Subscription completed');
  },
});

// 当不需要时调用 unsubscribe() 停止订阅
```

### 5. 启用消息压缩

#### 服务端：响应数据压缩

```typescript
// 在 addWebView 时指定
ipcHandler.addWebView(webview, undefined, {
  largeQuery: true,
  'aaa.bbb': true, //嵌套路由
});
```

#### 客户端：请求数据压缩

```typescript
// 对象压缩
const largeData = await trpc.largeQuery.query(
  {},
  {
    context: { compress: true }, // 标记此请求需要压缩
  },
);

// Uint8Array 压缩
await trpc.importData.query(new Uint8Array(largeBuffer), {
  context: { compress: true },
});
```

---

## API 参考

### 服务端

#### `createIPCHandler<TRouter>(options)`

创建用于在扩展主机中管理 tRPC 过程的 IPC Handler。

| 参数             | 类型                                               | 说明                          |
| ---------------- | -------------------------------------------------- | ----------------------------- |
| `router`         | `TRouter`                                          | tRPC 应用 Router 实例（必需） |
| `createContext?` | `(opts: CreateContextOptions) => Promise<Context>` | 可选的上下文工厂函数          |

**CreateContextOptions 参数：**

```typescript
interface CreateContextOptions {
  webview: vscode.Webview; // Webview 实例
  [key: string]: any; // addWebView 传入的 extraContext
}
```

#### `IPCHandler.addWebView(webview, extraContext?, compressPathObj?)`

注册 Webview 处理 tRPC 请求。

| 参数               | 类型                      | 说明                                  |
| ------------------ | ------------------------- | ------------------------------------- |
| `webview`          | `vscode.Webview`          | 要注册的 Webview 实例                 |
| `extraContext?`    | `Record<string, any>`     | 额外注入到 createContext 上下文的字段 |
| `compressPathObj?` | `Record<string, boolean>` | 按过程路径启用服务端响应压缩          |

**压缩路径配置示例：**

```typescript
ipcHandler.addWebView(webview, undefined, {
  largeQuery: true,
  'aaa.bbb': true, //嵌套路由
});
```

#### `IPCHandler.removeWebView(webview)`

移除 Webview 注册，清理所有相关订阅和监听器。

```typescript
import { createIPCHandler } from '@cyia/vscode-trpc/server';

// 创建 Handler
const handler = createIPCHandler<AppRouter>({
  router,
  createContext: async ({ webview, ...ctx }) => ({ ...ctx }),
});

// 注册/移除 Webview
handler.addWebView(webview, extraContext?, compressPaths?);
handler.removeWebView(webview);
```

### 客户端

```typescript
import { ipcLink } from '@cyia/vscode-trpc/client';

// 可选：配置 Transformer（自定义序列化/反序列化）
ipcLink({ transformer: myTransformer });

// 在 tRPC 客户端中使用
const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});
```
