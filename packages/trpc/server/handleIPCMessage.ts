import {
  callTRPCProcedure,
  transformTRPCResponse,
  TRPCError,
} from '@trpc/server';
import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server';
import type { TRPCResponseMessage, TRPCResultMessage } from '@trpc/server/rpc';
import {
  isObservable,
  observableToAsyncIterable,
} from '@trpc/server/observable';
import { getErrorShape } from '@trpc/server/shared';
import { getTRPCErrorFromUnknown } from './utils';
import { Webview } from 'vscode';
import { CreateContextOptions } from './type';
import { Message } from '../type';
import { compress } from 'snappyjs';
import {
  isAsyncIterable,
  isTrackedEnvelope,
  iteratorResource,
  run,
  Unpromise,
} from '@trpc/server/unstable-core-do-not-import';
import { Buffer } from 'node:buffer';

export async function handleIPCMessage<TRouter extends AnyTRPCRouter>({
  router,
  createContext,
  message,
  webview,
  subscriptions,
  extraContext,
  compressPathObj,
}: {
  router: TRouter;
  createContext?: (
    opts: CreateContextOptions,
  ) => Promise<inferRouterContext<TRouter>>;
  message: Message;
  webview: Webview;
  subscriptions: Map<string, AbortController>;
  extraContext?: Record<string, any>;
  compressPathObj?: Record<string, boolean>;
}) {
  const internalId = message.id;
  if (message.method === 'subscription.stop') {
    subscriptions.get(internalId)?.abort();
    subscriptions.delete(internalId);
    return;
  }

  const { type, input: serializedInput, path } = message.operation;
  const id = internalId;

  const input =
    serializedInput != null
      ? router._def._config.transformer.input.deserialize(serializedInput)
      : undefined;

  const ctx =
    (await createContext?.({ ...extraContext, webview: webview })) ?? {};

  const respond = (response: TRPCResponseMessage) => {
    let message = transformTRPCResponse(router._def._config, response);
    if (compressPathObj?.[path]) {
      if (message instanceof Uint8Array) {
        message = {
          __compress: true,
          __result: compress(message),
          __version: 2,
        } as any;
      } else {
        message = {
          __compress: true,
          __result: compress(
            new Uint8Array(Buffer.from(JSON.stringify(message))),
          ),
          __version: 1,
        } as any;
      }
    }
    webview.postMessage(message);
  };
  try {
    const abortController = new AbortController();
    // 函数请求
    const result = await callTRPCProcedure({
      ctx,
      path,
      router: router,
      getRawInput: async () => input,
      type,
      signal: abortController.signal,
      batchIndex: 0,
    });

    const isIterableResult = isAsyncIterable(result) || isObservable(result);
    // 普通的请求
    if (type !== 'subscription') {
      if (isIterableResult) {
        throw new TRPCError({
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Cannot return an async iterable or observable from a ${type} procedure with WebSockets`,
        });
      }
      // send the value as data if the method is not a subscription
      respond({
        id,
        result: {
          type: 'data',
          data: result,
        },
      });
      return;
    }

    if (!isIterableResult) {
      throw new TRPCError({
        message: `Subscription ${path} did not return an observable or a AsyncGenerator`,
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
    if (subscriptions.has(internalId)) {
      // duplicate request ids for client

      throw new TRPCError({
        message: `Duplicate id ${internalId}`,
        code: 'BAD_REQUEST',
      });
    }
    // 订阅请求
    const iterable = isObservable(result)
      ? observableToAsyncIterable(result, abortController.signal)
      : result;

    run(async () => {
      await using iterator = iteratorResource(iterable);

      const abortPromise = new Promise<'abort'>((resolve) => {
        abortController.signal.onabort = () => resolve('abort');
      });
      // We need those declarations outside the loop for garbage collection reasons. If they
      // were declared inside, they would not be freed until the next value is present.
      let next:
        | null
        | TRPCError
        | Awaited<typeof abortPromise | ReturnType<(typeof iterator)['next']>>;
      let result: null | TRPCResultMessage<unknown>['result'];

      while (true) {
        next = await Unpromise.race([
          iterator.next().catch(getTRPCErrorFromUnknown),
          abortPromise,
        ]);

        if (next === 'abort') {
          await iterator.return?.();
          break;
        }
        if (next instanceof Error) {
          const error = getTRPCErrorFromUnknown(next);
          respond({
            id,
            error: getErrorShape({
              config: router._def._config,
              error,
              type,
              path,
              input,
              ctx,
            }),
          });
          break;
        }
        if (next.done) {
          break;
        }

        result = {
          type: 'data',
          data: next.value,
        };

        if (isTrackedEnvelope(next.value)) {
          const [id, data] = next.value;
          result.id = id;
          result.data = {
            id,
            data,
          };
        }

        respond({
          id,
          result,
        });

        // free up references for garbage collection
        next = null;
        result = null;
      }

      respond({
        id,
        result: {
          type: 'stopped',
        },
      });
      subscriptions.delete(internalId);
    }).catch((cause) => {
      const error = getTRPCErrorFromUnknown(cause);
      respond({
        id,
        error: getErrorShape({
          config: router._def._config,
          error,
          type,
          path,
          input,
          ctx,
        }),
      });
      abortController.abort();
    });

    respond({
      id,
      result: {
        type: 'started',
      },
    });
    subscriptions.set(internalId, abortController);
  } catch (cause) {
    const error: TRPCError = getTRPCErrorFromUnknown(cause);

    return respond({
      id,
      error: getErrorShape({
        config: router._def._config,
        error,
        type,
        path,
        input,
        ctx,
      }),
    });
  }
}
