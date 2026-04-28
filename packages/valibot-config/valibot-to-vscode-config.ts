import type { SchemaOrPipe } from '@piying/valibot-visit';
import { JsonSchema, toJsonSchema } from '@valibot/to-json-schema';
import type * as v from 'valibot';
import { deepEqual } from 'fast-equals';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const notValue = { not: {} };

function isNot(a: any) {
  return deepEqual(notValue, a) ? undefined : a;
}

function filterNot(a: any) {
  if (Array.isArray(a)) {
    return a.filter((item) => !deepEqual(notValue, item));
  }
  return a;
}

function filterObjNot(a: any) {
  if (a && typeof a === 'object') {
    return Object.keys(a).reduce(
      (pre, cur) => {
        if (!deepEqual(notValue, a[cur])) {
          pre[cur] = a[cur];
        }
        return pre;
      },
      {} as Record<string, any>,
    );
  }
  return a;
}

/**
 * Filters undefined values from a JSON Schema object based on the schema type.
 * This function mimics the logic in convertSchema to determine which properties
 * may contain undefined values that need to be filtered.
 *
 * @param jsonSchema The JSON Schema object to filter
 * @param schemaType The Valibot schema type
 * @returns The filtered JSON Schema object
 */
function filterUndefined(
  jsonSchema: JsonSchema,
  schemaType: string,
): JsonSchema {
  const result: JsonSchema = { ...jsonSchema };

  switch (schemaType) {
    case 'array': {
      result.items = isNot(result.items);
      break;
    }
    case 'tuple':
    case 'tuple_with_rest':
    case 'loose_tuple':
    case 'strict_tuple': {
      if (jsonSchema.items && 'anyOf' in (jsonSchema as any).items) {
        result.items = filterNot((jsonSchema.items as any).anyOf as any);
      }

      result.prefixItems = filterNot(result.prefixItems);
      if (schemaType === 'tuple_with_rest') {
        result.items = isNot(result.items);
        result.additionalItems = isNot(result.additionalItems);
      }
      result.items = filterNot(result.items);

      break;
    }

    case 'object':
    case 'object_with_rest':
    case 'loose_object':
    case 'strict_object': {
      result.properties = filterObjNot(result.properties);
      result.additionalProperties = isNot(result.additionalProperties);
      break;
    }

    case 'record': {
      result.propertyNames = isNot(result.propertyNames);
      result.additionalProperties = isNot(result.additionalProperties);
      break;
    }

    case 'nullable':
    case 'nullish': {
      result.anyOf = filterNot(result.anyOf);
      break;
    }

    case 'union': {
      result.anyOf = filterNot(result.anyOf);
      break;
    }
    case 'variant': {
      result.oneOf = filterNot(result.oneOf);
      break;
    }
    case 'intersect': {
      result.allOf = filterNot(result.allOf);
      break;
    }
  }

  return result;
}

export function valibotToVscodeConfig(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  options: { title: string; prefix: string; id?: string; order?: number },
) {
  const jsonSchema = toJsonSchema(schema, {
    overrideSchema: (context) => {
      const jsonSchema = context.jsonSchema;
      const valibotSchema = context.valibotSchema;

      switch (valibotSchema.type) {
        case 'object':
        case 'object_with_rest':
        case 'loose_object':
        case 'strict_object': {
          const schema = valibotSchema as v.ObjectSchema<any, any>;
          for (const key in schema.entries) {
            const entry = schema.entries[key] as SchemaOrPipe;
            const property = jsonSchema.properties![key];
            if (property) {
              if (
                jsonSchema.required &&
                ((property as any).__isOptional ||
                  entry.type == 'nullish' ||
                  entry.type == 'optional')
              ) {
                (jsonSchema.required as string[]) = (
                  jsonSchema.required as string[]
                ).filter((k) => k !== key);
              }
              delete (property as any).__isOptional;
            } else {
              delete jsonSchema.properties?.[key];
            }
          }
          break;
        }
        case 'void': {
          jsonSchema.not = {};
        }
      }
      const result = filterUndefined(context.jsonSchema, valibotSchema.type);
      return result;
    },
    overrideAction: (context) => {
      const action = context.valibotAction;
      let jsonSchema = context.jsonSchema;
      switch (action.type) {
        case 'description': {
          if (typeof (action as any).description === 'string') {
            (jsonSchema as any).markdownDescription = (
              action as any
            ).description;
            delete jsonSchema.description;
          }

          break;
        }
        case 'metadata': {
          const data = (action as any).metadata as {
            enumOptions?: {
              description: string;
              label: string;
            }[];
            isOptional?: boolean;
          };
          if (data.enumOptions) {
            (jsonSchema as any).markdownEnumDescriptions = data.enumOptions.map(
              (item) => item.description,
            );
            (jsonSchema as any).enumItemLabels = data.enumOptions.map(
              (item) => item.label,
            );
          }
          if (data.isOptional) {
            (jsonSchema as any).__isOptional = data.isOptional;
          }
          break;
        }
        case 'asVirtualGroup': {
          if (jsonSchema.allOf) {
            const data = { type: 'object' } as JsonSchema;
            for (const option of jsonSchema.allOf) {
              data.required = [
                ...(data.required ?? []),
                ...((option as JsonSchema).required || []),
              ];
              data.properties = {
                ...data.properties,
                ...(option as JsonSchema).properties,
              };
              if ((option as JsonSchema).additionalProperties === false) {
                data.additionalProperties = false;
              }
            }
            if (!data.required?.length) {
              delete data.required;
            }
            jsonSchema = data;
          }
          break;
        }
        default:
          break;
      }

      return jsonSchema;
    },
    ignoreActions: ['asControl', 'trim', 'viewRawConfig'],
  });
  jsonSchema.title = options.title;
  for (const key in jsonSchema.properties) {
    jsonSchema.properties[`${options.prefix}.${key}`] =
      jsonSchema.properties[key];
    delete jsonSchema.properties[key];
  }
  //   delete jsonSchema.type;
  delete jsonSchema.required;
  delete jsonSchema.$schema;
  if (typeof options.id === 'string') {
    (jsonSchema as any).id = options.id;
  }
  if (typeof options.order === 'number') {
    (jsonSchema as any).order = options.order;
  }
  return jsonSchema;
}

export function writePackageJsonConfig(
  ...args: Parameters<typeof valibotToVscodeConfig>
) {
  const config = valibotToVscodeConfig(...args);
  return (target: string | Record<string, any>) => {
    if (typeof target === 'string') {
      const filePath = resolve(target);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      data['contributes'] ??= {};
      data['contributes']['configuration'] = config;
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } else {
      target['contributes'] ??= {};
      target['contributes']['configuration'] = config;
      return target;
    }
  };
}
