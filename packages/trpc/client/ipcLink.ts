import { Operation, TRPCClientError, TRPCLink } from '@trpc/client';
import type {
  AnyRouter,
  AnyTRPCRouter,
  inferRouterContext,
  inferTRPCClientTypes,
  ProcedureType,
} from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import { observable, Observer } from '@trpc/server/observable';
import { Message } from '../type';
import { compress, uncompress } from 'snappyjs';
import {
  getTransformer,
  TransformerOptions,
} from '@trpc/client/unstable-internals';
import { transformResult } from '@trpc/server/unstable-core-do-not-import';

const vscode = window.vscode ?? acquireVsCodeApi();

type IPCCallbackResult<TRouter extends AnyRouter = AnyRouter> =
  TRPCResponseMessage<unknown, inferRouterContext<TRouter>>;

type IPCCallbacks<TRouter extends AnyRouter = AnyRouter> = Observer<
  IPCCallbackResult<TRouter>,
  TRPCClientError<TRouter>
>;

type IPCRequest = {
  type: ProcedureType;
  callbacks: IPCCallbacks;
  op: Operation;
};
const encoder = new TextEncoder();

class IPCClient {
  #pendingRequests = new Map<string | number, IPCRequest>();

  constructor() {
    window.addEventListener('message', (event) => {
      let data = event.data;
      if ('__compress' in data && '__result' in data && '__version' in data) {
        if (data.__version === 1) {
          data = JSON.parse(
            new TextDecoder().decode(uncompress(data.__result)),
          );
        } else {
          data = uncompress(data.__result);
        }
      }
      this.#handleResponse(data);
    });
  }

  #handleResponse(response: TRPCResponseMessage) {
    const request = response.id && this.#pendingRequests.get(response.id);
    if (!request) {
      return;
    }

    request.callbacks.next(response);

    if ('result' in response && response.result.type === 'stopped') {
      request.callbacks.complete();
    }
  }
  index = 0;
  request(op: Operation, callbacks: IPCCallbacks) {
    const { type } = op;
    const id = `${this.index++}`;

    this.#pendingRequests.set(id, {
      type,
      callbacks,
      op,
    });
    const message = { method: 'request', operation: op, id: id } as Message;
    if (op.context['compress']) {
      let cmpInput;
      if (message.operation.input instanceof Uint8Array) {
        cmpInput = {
          __compress: true,
          __result: compress(message.operation.input),
          __version: 2,
        };
      } else {
        const data = encoder.encode(JSON.stringify(message.operation.input));
        cmpInput = {
          __compress: true,
          __result: compress(data),
          __version: 1,
        };
      }
      message.operation.input = cmpInput;
    }
    vscode.postMessage(message);

    return () => {
      const callbacks = this.#pendingRequests.get(id)?.callbacks;

      this.#pendingRequests.delete(id);

      callbacks?.complete();

      if (type === 'subscription') {
        vscode.postMessage({
          id,
          operation: {},
          method: 'subscription.stop',
        });
      }
    };
  }
}

export type IPCLinkOptions<TRouter extends AnyTRPCRouter> = TransformerOptions<
  inferTRPCClientTypes<TRouter>
>;
export function ipcLink<TRouter extends AnyRouter>(
  opts?: IPCLinkOptions<TRouter>,
): TRPCLink<TRouter> {
  return () => {
    const client = new IPCClient();
    const transformer = getTransformer(opts?.transformer);

    return ({ op }) =>
      observable((observer) => {
        op.input = transformer.input.serialize(op.input);

        const unsubscribe = client.request(op, {
          error(err) {
            observer.error(err as TRPCClientError<any>);
            unsubscribe();
          },
          complete() {
            observer.complete();
          },
          next(response) {
            const transformed = transformResult(response, transformer.output);

            if (!transformed.ok) {
              observer.error(TRPCClientError.from(transformed.error));
              return;
            }

            observer.next({ result: transformed.result });

            if (op.type !== 'subscription') {
              unsubscribe();
              observer.complete();
            }
          },
        });

        return () => {
          unsubscribe();
        };
      });
  };
}
