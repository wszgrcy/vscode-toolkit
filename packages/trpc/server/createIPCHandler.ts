import type { AnyRouter, inferRouterContext } from '@trpc/server';
import { handleIPCMessage } from './handleIPCMessage';
import { CreateContextOptions } from './type';
import type { Disposable, Webview } from 'vscode';
import { Message } from '../type';
import { uncompress } from 'snappyjs';

type Awaitable<T> = T | Promise<T>;
const decoder = new TextDecoder();
class IPCHandler<TRouter extends AnyRouter> {
  #webviewDisposeable = new WeakMap<Webview, Disposable>();
  #weakMap = new WeakMap<Webview, Map<string, AbortController>>();
  #getWebviewSubscription(webview: Webview) {
    let item = this.#weakMap.get(webview);
    if (!item) {
      item = new Map();
      this.#weakMap.set(webview, item);
    }
    return item;
  }
  constructor(
    private options: {
      createContext?: (
        opts: CreateContextOptions,
      ) => Awaitable<inferRouterContext<TRouter>>;
      router: TRouter;
    },
  ) {}

  addWebView(
    webview: Webview,
    extraContext?: Record<string, any>,
    compressPathObj?: Record<string, boolean>,
  ) {
    const ref = webview.onDidReceiveMessage((message: Message) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !message.id ||
        !message.method ||
        !message.operation
      ) {
        return;
      }
      let data = message.operation.input as any;
      if (
        data &&
        typeof data === 'object' &&
        '__compress' in data &&
        '__result' in data &&
        '__version' in data
      ) {
        if (data.__version === 1) {
          data = JSON.parse(decoder.decode(uncompress(data.__result as any)));
        } else {
          data = uncompress(data.__result as any);
        }
        message.operation.input = data;
      }

      handleIPCMessage({
        router: this.options.router,
        createContext: this.options.createContext,
        message,
        webview,
        subscriptions: this.#getWebviewSubscription(webview),
        extraContext,
        compressPathObj,
      });
    });
    this.#webviewDisposeable.set(webview, ref);
  }
  removeWebView(webview: Webview) {
    this.#webviewDisposeable.get(webview)!.dispose();
    this.#webviewDisposeable.delete(webview);
    this.#weakMap.get(webview)?.forEach((item) => {
      item.abort();
    });
    this.#weakMap.delete(webview);
  }
}

export const createIPCHandler = <TRouter extends AnyRouter>({
  createContext,
  router,
}: {
  createContext?: (
    opts: CreateContextOptions,
  ) => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
}) => new IPCHandler({ createContext, router });
