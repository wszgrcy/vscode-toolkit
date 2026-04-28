# @cyia/vscode-trpc

<div align="center">

🌐 [English](README.md) | [中文](./README.zh-CN.md)

</div>

tRPC integration for VS Code Extension-Webview communication, enabling type-safe procedure calls between extension host and webviews.

## Features

- **Type-safe IPC**: Leverages tRPC's end-to-end type safety for extension-webview communication
- **IPC Link**: Custom `ipcLink` transport that uses VS Code's postMessage API
- **Compression Support**: Built-in message compression using snappyjs for efficient data transfer
- **Subscription Support**: Real-time subscriptions from extension to webview
- **Context Injection**: Flexible context creation with access to webview instances

## Installation

```bash
npm install @cyia/vscode-trpc
# or
pnpm add @cyia/vscode-trpc
```

## Usage

### Server Side (Extension Host)

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

// Create IPC handler
const ipcHandler = createIPCHandler<AppRouter>({
  router: appRouter,
  createContext: async ({ webview }) => ({
    // your context here
  }),
});

// Register webview
const panel = vscode.window.createWebviewPanel(...);
ipcHandler.addWebView(panel.webview);

// Cleanup on dispose
panel.onDidDispose(() => {
  ipcHandler.removeWebView(panel.webview);
});
```

### Client Side (Webview)

```typescript
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from '@cyia/vscode-trpc/client';
import type { AppRouter } from '../extension'; // share types

const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});

// Call procedure
const result = await trpc.greet.query({ name: 'World' });
console.log(result); // "Hello, World!"
```

## API Reference

### Server

#### `createIPCHandler<TRouter>(options)`

Creates an IPC handler for managing tRPC procedures in the extension host.

```typescript
function createIPCHandler<TRouter extends AnyRouter>({
  createContext?: (opts: CreateContextOptions) => Promise<RouterContext>,
  router: TRouter,
}): IPCHandler<TRouter>
```

**Methods:**

- `addWebView(webview, extraContext?, compressPathObj?)` - Register a webview for handling tRPC requests
- `removeWebView(webview)` - Unregister and cleanup a webview

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `createContext` | `Function` | Optional async function to create router context |
| `router` | `TRouter` | The tRPC router instance |
| `extraContext` | `Record<string, any>` | Additional context to merge into every request |
| `compressPathObj` | `Record<string, boolean>` | Path-based compression configuration |

#### `CreateContextOptions`

```typescript
interface CreateContextOptions {
  webview: Webview;
  [name: string]: any;
}
```

### Client

#### `ipcLink<TRouter>(options?)`

Returns a tRPC link that communicates with the extension host via VS Code's postMessage API.

```typescript
function ipcLink<TRouter extends AnyRouter>(
  opts?: TransformerOptions
): TRPCLink<TRouter>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `transformer` | `TransformerOptions` | Optional input/output transformers for data serialization |

## Compression

Messages can be compressed using snappyjs to reduce payload size:

- **Client-side**: Set `compress: true` in procedure context to compress request inputs
- **Server-side**: Configure `compressPathObj` to compress specific procedure responses

```typescript
// Client - compress input
await trpc.largeProcedure.mutate(data, {
  context: { compress: true },
});

// Server - compress output for specific paths
ipcHandler.addWebView(webview, undefined, {
  'largeProcedure': true,
  'nested.procedure': true,
});
```

