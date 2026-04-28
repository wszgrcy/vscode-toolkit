import { Subject } from 'rxjs';
import { initTRPC } from '@trpc/server';
import * as v from 'valibot';
const t = initTRPC.create();

export const callInputSubject = new Subject<{
  path: string;
  input?: any;
  value?: any;
}>();

export const appRouter = t.router({
  hello: t.procedure.query(() => {
    callInputSubject.next({ path: 'hello' });
    return 'word';
  }),
  input1: t.procedure.input(v.object({ a1: v.string() })).query((opts) => {
    callInputSubject.next({ path: 'input1', input: opts.input });
    return 'word';
  }),
  r1: t.router({
    r2: t.procedure.query(() => {
      callInputSubject.next({ path: 'r1.r2' });
      return 'word';
    }),
  }),
  cmp1: t.procedure.query(() => ({
    arr1: [1, 2, 3],
    num1: 1,
    str1: '1',
    b1: true,
  })),
  cmp2: t.router({
    cmp1: t.procedure.query(() => ({
      arr1: [1, 2, 3],
      num1: 1,
      str1: '1',
      b1: true,
    })),
  }),
  cmp3: t.procedure.query(() => new Uint8Array([1, 2, 3, 4])),
  cmp4: t.router({
    cmp3: t.procedure.query(() => new Uint8Array([1, 2, 3, 4])),
  }),
  clientCmp: t.procedure
    .input(
      v.object({
        arr1: v.array(v.number()),
        num1: v.number(),
        str1: v.string(),
        b1: v.boolean(),
      }),
    )
    .query(({ input }) => {
      callInputSubject.next({ path: 'clientCmp', input: input });
      return true;
    }),
  clientCmpUint8: t.procedure
    .input(v.custom((a) => a instanceof Uint8Array))
    .query(({ input }) => {
      callInputSubject.next({ path: 'clientCmpUint8', input: input });
    }),
  getResult: t.procedure
    .input(v.object({ path: v.string(), value: v.any() }))
    .query(({ input }) => {
      callInputSubject.next(input);
    }),
});

export type AppRouter = typeof appRouter;
