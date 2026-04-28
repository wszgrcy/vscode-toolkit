# @cyia/vscode-trpc

<div align="center">

🌐 [English](README.md) | [中文](README.zh-CN.md)

</div>

tRPC integration for communication between VS Code extension host and Webview, enabling end-to-end type-safe RPC calls.

## Features

- **Type Safe**: Leverage tRPC's end-to-end type safety with shared Router type definitions between extension host and Webview
- **IPC Link**: Custom tRPC transport layer based on VS Code `postMessage` API
- **Message Compression**: Built-in [snappyjs](https://github.com/kubanco/snappyjs) compression support with fine-grained control over which procedures need compression
- **Subscription Support**: Supports tRPC Subscription (Observable / AsyncGenerator) for real-time bidirectional communication
- **Flexible Context**: Inject custom context via `createContext` (e.g., webview instance, extension state, etc.)

## Installation

```bash
npm install @cyia/vscode-trpc
# or
pnpm add @cyia/vscode-trpc
```

> **Dependency**: This package requires `@trpc/server` and `@trpc/client` as peer dependencies.

## Exports

| Import Path                | Description                          |
| -------------------------- | ------------------------------------ |
| `@cyia/vscode-trpc/server` | Server utilities: `createIPCHandler` |
| `@cyia/vscode-trpc/client` | Client utilities: `ipcLink`          |

---

## Quick Start

### 1. Define Router

First, define the tRPC Router in code shared between extension host and Webview:

```typescript
import { initTRPC } from '@trpc/server';
import * as v from 'valibot';

const t = initTRPC.create();

export const appRouter = t.router({
  // Simple query
  hello: t.procedure.query(() => 'Hello World'),

  // Query with input validation
  getUser: t.procedure
    .input(v.object({ id: v.string() }))
    .query(({ input }) => ({ name: 'Alice', id: input.id })),

  // Nested router
  posts: t.router({
    list: t.procedure.query(() => [{ id: 1, title: 'First Post' }]),
  }),
});

export type AppRouter = typeof appRouter;
```

> The Router definition file should be located in the module shared between extension host and Webview to ensure end-to-end TypeScript type inference.

### 2. Extension Host — Register IPC Handler

```typescript
import { Disposable } from 'vscode';
import { createIPCHandler } from '@cyia/vscode-trpc/server';
import { appRouter, AppRouter } from './shared/router';

// Create IPC Handler
const ipcHandler = createIPCHandler<AppRouter>({
  router: appRouter,

  // Optional: custom context, can access webview instance
  createContext: async (options) => ({
    ...options,
  }),
});

// When activating extension, register Webview to Handler
function registerWebviewPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'myPanel',
    'My Panel',
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  // Register webview (automatically binds message listener)
  ipcHandler.addWebView(panel.webview);

  // Can also pass extra context and compression config
  // ipcHandler.addWebView(panel.webview, { userId: '123' }, { 'posts.list': true });

  panel.onDidDispose(() => {
    // Remove registration when panel is closed, clean up subscriptions
    ipcHandler.removeWebView(panel.webview);
  });

  return panel;
}
```

### 3. Webview — Create tRPC Client

```typescript
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from '@cyia/vscode-trpc/client';
import type { AppRouter } from '../shared/router';

// Create client in Webview
const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

// Call query
async function loadHello() {
  const result = await trpc.hello.query();
  console.log(result); // 'Hello World'
}

// Query with input
async function loadUser() {
  const user = await trpc.getUser.query({ id: '42' });
  console.log(user.name); // 'Alice'
}

// Nested router call
const posts = await trpc.posts.list.query();
```

### 4. Subscribe to Real-time Data

```typescript
// Define Subscription in extension host's Router
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

// Subscribe in Webview
const unsubscribe = trpc.counter.subscribe(undefined, {
  onNext(value) {
    console.log('Count:', value);
  }, // Increments every second
  onError(error) {
    console.error('Subscription error:', error);
  },
  onCompleted() {
    console.log('Subscription completed');
  },
});

// Call unsubscribe() when no longer needed to stop subscription
```

### 5. Enable Message Compression

#### Server: Response Data Compression

```typescript
// Specify when calling addWebView
ipcHandler.addWebView(webview, undefined, {
  largeQuery: true,
  'aaa.bbb': true, // Nested router
});
```

#### Client: Request Data Compression

```typescript
// Object compression
const largeData = await trpc.largeQuery.query(
  {},
  {
    context: { compress: true }, // Mark this request for compression
  },
);

// Uint8Array compression
await trpc.importData.query(new Uint8Array(largeBuffer), {
  context: { compress: true },
});
```

---

## API Reference

### Server

#### `createIPCHandler<TRouter>(options)`

Create an IPC Handler to manage tRPC procedures in the extension host.

| Parameter        | Type                                               | Description                         |
| ---------------- | -------------------------------------------------- | ----------------------------------- |
| `router`         | `TRouter`                                          | tRPC App Router instance (required) |
| `createContext?` | `(opts: CreateContextOptions) => Promise<Context>` | Optional context factory function   |

**CreateContextOptions parameters:**

```typescript
interface CreateContextOptions {
  webview: vscode.Webview; // Webview instance
  [key: string]: any; // extraContext passed from addWebView
}
```

#### `IPCHandler.addWebView(webview, extraContext?, compressPathObj?)`

Register a Webview to handle tRPC requests.

| Parameter          | Type                      | Description                                          |
| ------------------ | ------------------------- | ---------------------------------------------------- |
| `webview`          | `vscode.Webview`          | Webview instance to register                         |
| `extraContext?`    | `Record<string, any>`     | Extra fields to inject into createContext context    |
| `compressPathObj?` | `Record<string, boolean>` | Enable server response compression by procedure path |

**Compression path configuration example:**

```typescript
ipcHandler.addWebView(webview, undefined, {
  largeQuery: true,
  'aaa.bbb': true, // Nested router
});
```

#### `IPCHandler.removeWebView(webview)`

Remove Webview registration and clean up all related subscriptions and listeners.

```typescript
import { createIPCHandler } from '@cyia/vscode-trpc/server';

// Create Handler
const handler = createIPCHandler<AppRouter>({
  router,
  createContext: async ({ webview, ...ctx }) => ({ ...ctx }),
});

// Register/Remove Webview
handler.addWebView(webview, extraContext?, compressPaths?);
handler.removeWebView(webview);
```

### Client

```typescript
import { ipcLink } from '@cyia/vscode-trpc/client';

// Optional: Configure Transformer (custom serialization/deserialization)
ipcLink({ transformer: myTransformer });

// Use in tRPC client
const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});
```
