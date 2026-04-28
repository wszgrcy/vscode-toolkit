import * as vscode from 'vscode';
import * as v from 'valibot';
import { deepEqual } from 'fast-equals';
import { getDefaults } from '@piying/valibot-visit';
import { signal, WritableSignal } from 'static-injector';
import rfdc from 'rfdc';
import { set } from 'es-toolkit/compat';

const clone = rfdc();
type ConfigSignal<T> = WritableSignal<NonNullable<T>>;
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer R,
) => void
  ? R extends Record<string, any>
    ? R
    : never
  : never;
export type ResolveConfig<T extends Record<string, any>> = {
  [P in keyof T]-?: NonNullable<T[P]> extends object
    ? ResolveConfig<UnionToIntersection<NonNullable<T[P]>>> & ConfigSignal<T[P]>
    : ConfigSignal<T[P]>;
};
function coreSchema(schema: { wrapped?: any }) {
  while ('wrapped' in schema) {
    schema = schema.wrapped;
  }
  return schema;
}
type ObjectSchema =
  | v.ObjectSchema<any, any>
  | v.LooseObjectSchema<any, any>
  | v.StrictObjectSchema<any, any>
  | v.ObjectWithRestSchema<any, any, any>;
type BaseSchema = v.BaseSchema<any, any, any>;
function isObject(input: any): input is ObjectSchema {
  return (
    v.isOfType('object', input as any) ||
    v.isOfType('loose_object', input as any) ||
    v.isOfType('object_with_rest', input as any) ||
    v.isOfType('strict_object', input as any)
  );
}
function findIntersectItem(
  schema: v.IntersectSchema<[ObjectSchema], any>,
  key: string,
) {
  for (const item of schema.options) {
    if (isObject(item)) {
      if (key in item.entries) {
        return item.entries[key];
      }
    } else {
      return findIntersectItem(item as any, key);
    }
  }
}
function getDefaultParntValue(schema: BaseSchema) {
  return v.isOfType('array', schema) || v.isOfType('tuple', schema) ? [] : {};
}

function resolveSchemaPath(CONFIG: any, parentKey: string[]) {
  let c = CONFIG as any;
  for (const item of parentKey) {
    const wrapped = coreSchema(c) as any;
    if (isObject(wrapped)) {
      c = wrapped.entries[item];
    } else if (
      v.isOfType('intersect', wrapped as any) ||
      v.isOfType('union', wrapped as any)
    ) {
      c = findIntersectItem(wrapped as any, item);
    } else {
      throw `⚙️[${(wrapped as any).type}]❌`;
    }
  }
  return c;
}

export class ConfigProxy<T extends BaseSchema> {
  #CONFIG;
  #vsConfig;
  #prefix;
  #cache = new Map<
    string,
    { proxy: any; value$: WritableSignal<any>; schema: BaseSchema }
  >();
  #list: ((e: vscode.ConfigurationChangeEvent) => any)[] = [];
  #dispose?: vscode.Disposable;
  constructor(CONFIG: T, prefix: string) {
    this.#CONFIG = CONFIG;
    this.#vsConfig = vscode.workspace.getConfiguration(prefix);
    this.#prefix = prefix;
    this.#dispose = vscode.workspace.onDidChangeConfiguration((e) => {
      this.#list.forEach((fn) => fn(e));
    });
  }
  #getOrCreateSignal<T>(keyList: string[]) {
    const id = keyList.join('.');
    if (this.#cache.has(id)) {
      return this.#cache.get(id)!;
    }

    const schema = resolveSchemaPath(this.#CONFIG, keyList) as BaseSchema;
    const getValue = (init?: boolean) => {
      const result = this.#vsConfig.inspect(keyList.join('.'));
      // 🐛 保存后无法直接读取,需通过 inspect 获取,临时方案
      const value =
        result?.workspaceValue ??
        result?.workspaceFolderValue ??
        result?.globalValue ??
        result?.defaultValue;
      const result2 = v.safeParse(schema, value ?? getDefaults(schema as any));

      if (!result2.success && !init) {
        console.error('❌', v.summarize(result2.issues));
        const messageList = result2.issues.map(
          (item) =>
            `⚙️🔗[${[...keyList, ...item.path.map((item: any) => item.key)].join('.')}]❌\n${item.message ?? ''}`,
        );
        vscode.window.showWarningMessage(messageList.join('\n'));
        throw new Error(JSON.stringify(result2.issues));
      }
      return result2.output;
    };

    const value$ = signal<T>(getValue(true), { equal: deepEqual });
    this.#list.push((e) => {
      if (e.affectsConfiguration(`${this.#prefix}.${keyList[0]}`)) {
        value$.set(getValue());
      }
    });
    return { value$, schema };
  }
  #get(keyList: string[]): any {
    const cacheKey = keyList.join('.');
    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey)!.proxy;
    }

    const { value$, schema } = this.#getOrCreateSignal(keyList);
    const fn = () => value$();
    (fn as any)['set'] = (value: any) => {
      if (deepEqual(fn(), value)) {
        return;
      }
      const parsed = v.safeParse(schema, value);
      if (parsed.success) {
        value$.set(parsed.output);
      }

      if (keyList.length === 1) {
        return this.#vsConfig.update(keyList.join('.'), value);
      } else {
        const rootKey = keyList[0];
        const rootSignal = this.#getOrCreateSignal([rootKey]);
        const rootValue =
          clone(rootSignal.value$()) ?? getDefaultParntValue(rootSignal.schema);
        set(rootValue, keyList.slice(1), value);
        return this.#vsConfig.update(rootKey, rootValue);
      }
    };
    (fn as any)['update'] = async (updateFn: (value: any) => any) =>
      (fn as any)['set'](updateFn(fn()));

    const proxy = new Proxy(fn, {
      get: (target, p: string) => {
        if (p === 'set' || p === 'update') {
          return (target as any)[p];
        }
        return this.#get([...keyList, p]);
      },
    });

    this.#cache.set(cacheKey, { proxy, value$, schema });
    return proxy;
  }
  root() {
    return this.#get([]) as ResolveConfig<v.InferOutput<T>>;
  }
  dispose() {
    this.#dispose?.dispose();
    this.#dispose = undefined;
  }
}

export function createConfig<T extends BaseSchema>(define: T, prefix: string) {
  return new ConfigProxy(define, prefix);
}
