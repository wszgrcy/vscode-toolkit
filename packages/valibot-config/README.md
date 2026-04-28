# @cyia/vscode-valibot-config

<div align="center">

🌐 [English](README.md) | [中文](./README.zh-CN.md)

</div>

VSCode configuration manager based on Valibot schemas. Provides reactive signals that automatically sync with VS Code's workspace settings, with built-in validation and real-time update support.

## Features

- **Schema Validation**: Define configuration structure using Valibot schemas
- **Reactive Signals**: Configuration values are exposed as writable signals with automatic change detection
- **Deep Nesting**: Full support for nested object configurations
- **Real-time Updates**: Automatically listens to VS Code configuration changes
- **JSON Schema Export**: Generate VSCode-compatible JSON Schema from Valibot schemas
- **Type Safety**: End-to-end TypeScript type inference from schema definitions
- **Deep Equality**: Uses deep comparison to prevent unnecessary signal updates
- **Union & Variant Support**: Handles complex union types and discriminated unions

## Installation

```bash
npm install @cyia/vscode-valibot-config
# or
pnpm add @cyia/vscode-valibot-config
```

## Requirements

- VS Code Extension environment (requires `vscode` module)
- Peer dependencies installed: `valibot`, `static-injector`

## Usage

### Basic Example

```typescript
import * as v from 'valibot';
import { createConfig } from '@cyia/vscode-valibot-config';

// Define configuration schema
const configSchema = v.object({
  enabled: v.boolean(),
  timeout: v.pipe(v.number(), v.minValue(100), v.maxValue(5000)),
  theme: v.picklist(['dark', 'light', 'auto']),
  tags: v.array(v.string()),
  nested: v.object({
    host: v.string(),
    port: v.number(),
  }),
});

// Create reactive configuration
const proxy = createConfig(configSchema, 'myExtension');
const config = proxy.root();

// Read values (call as function)
console.log(config.enabled()); // true
console.log(config.timeout()); // 1000
console.log(config.nested.host()); // "localhost"

// Set values
await config.enabled.set(false);
await config.timeout.set(2000);

// Update values with function
await config.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));

// Nested objects
await config.nested.set({ host: 'api.example.com', port: 8080 });
```

### Signal API

Each configuration property returns a signal with the following methods:

| Method              | Description                              |
| ------------------- | ---------------------------------------- |
| `signal()`          | Get current value                        |
| `signal.set(value)` | Set new value (updates VS Code settings) |
| `signal.update(fn)` | Update using previous value              |

### JSON Schema Generation

Convert Valibot schemas to VSCode `contributes.configuration.properties` format:

```typescript
import * as v from 'valibot';
import { valibotToVscodeConfig } from '@cyia/vscode-valibot-config';
import { description, metadata, asVirtualGroup } from '@piying/valibot-visit';

const schema = v.object({
  name: v.pipe(v.string(), description('The user name')),
  role: v.pipe(
    v.picklist(['admin', 'user']),
    metadata({
      enumOptions: [
        { label: 'Administrator', description: 'Full access' },
        { label: 'Regular User', description: 'Limited access' },
      ],
    }),
  ),
  section: asVirtualGroup(
    v.object({
      host: v.string(),
      port: v.number(),
    }),
    'Network Settings',
  ),
});

const jsonSchema = valibotToVscodeConfig(schema, {
  title: 'My Extension Config',
  prefix: 'myExtension',
  id: 'myExtension.schema.json',
  order: 1,
});

// Result can be used in package.json:
// "contributes": {
//   "configuration": {
//     "properties": jsonSchema.properties
//   }
// }
```

### Advanced Options

#### Using `metadata` for Enhanced UI

```typescript
import { metadata } from '@piying/valibot-visit';

const schema = v.object({
  mode: v.pipe(
    v.picklist(['fast', 'balanced', 'quality']),
    metadata({
      isOptional: true,
      enumOptions: [
        { label: 'Fast', description: 'Best performance' },
        { label: 'Balanced', description: 'Balanced trade-off' },
        { label: 'Quality', description: 'Best output quality' },
      ],
    }),
  ),
});
```

#### Virtual Groups for VSCode Settings UI

Group related settings under a collapsible section in VS Code settings:

```typescript
import { asVirtualGroup } from '@piying/valibot-visit';

const schema = v.object({
  network: asVirtualGroup(
    v.object({
      proxy: v.string(),
      timeout: v.number(),
    }),
    'Proxy Settings', // Display name in VS Code
  ),
});
```

### Supported Valibot Schemas

| Schema Type                           | Supported | Notes                            |
| ------------------------------------- | --------- | -------------------------------- |
| `v.object`                            | ✅        | Required and optional fields     |
| `v.looseObject`                       | ✅        | Allows additional properties     |
| `v.strictObject`                      | ✅        | No additional properties allowed |
| `v.objectWithRest`                    | ✅        | With rest schema for extra keys  |
| `v.array`                             | ✅        | Arrays of any type               |
| `v.tuple` / `v.tupleWithRest`         | ✅        | Fixed-length arrays              |
| `v.record`                            | ✅        | Key-value maps                   |
| `v.union`                             | ✅        | Multiple type alternatives       |
| `v.variant`                           | ✅        | Discriminated unions             |
| `v.intersect`                         | ✅        | Combined object types            |
| `v.nullable` / `v.nullish`            | ✅        | Null-handling                    |
| `v.optional`                          | ✅        | Optional fields                  |
| `v.pipe`                              | ✅        | With transforms and constraints  |
| `v.picklist`                          | ✅        | Enum-like selections             |
| `v.literal`                           | ✅        | Fixed values                     |
| `v.string` / `v.number` / `v.boolean` | ✅        | Primitive types                  |
