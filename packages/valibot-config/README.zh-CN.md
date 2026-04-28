# @cyia/vscode-valibot-config

<div align="center">

🌐 [English](./README.md) | [中文](README.zh-CN.md)

</div>

基于 Valibot Schema 的 VSCode 配置管理器。提供响应式信号，自动与 VS Code 工作区设置同步，内置验证和实时更新支持。

## 特性

- **Schema 验证**: 使用 Valibot Schema 定义配置结构
- **响应式信号**: 配置值以可写信号暴露，自动检测变更
- **深层嵌套**: 完整支持嵌套对象配置
- **实时更新**: 自动监听 VS Code 配置变更
- **JSON Schema 导出**: 从 Valibot Schema 生成 VSCode 兼容的 JSON Schema
- **类型安全**: 从 Schema 定义实现端到端的 TypeScript 类型推断
- **深度比较**: 使用深度比较防止不必要的信号更新
- **联合与变体支持**: 处理复杂的联合类型和判别联合

## 安装

```bash
npm install @cyia/vscode-valibot-config
# 或
pnpm add @cyia/vscode-valibot-config
```

## 使用示例

### 基础用法

```typescript
import * as v from 'valibot';
import { createConfig } from '@cyia/vscode-valibot-config';

// 定义配置 Schema
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

// 创建响应式配置
const proxy = createConfig(configSchema, 'myExtension');
const config = proxy.root();

// 读取值（以函数形式调用）
console.log(config.enabled()); // true
console.log(config.timeout()); // 1000
console.log(config.nested.host()); // "localhost"

// 设置值
await config.enabled.set(false);
await config.timeout.set(2000);

// 使用函数更新
await config.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));

// 嵌套对象
await config.nested.set({ host: 'api.example.com', port: 8080 });
```

### 信号 API

每个配置属性返回一个包含以下方法的信号：

| 方法                | 描述                          |
| ------------------- | ----------------------------- |
| `signal()`          | 获取当前值                    |
| `signal.set(value)` | 设置新值（更新 VS Code 设置） |
| `signal.update(fn)` | 使用函数更新值                |

### JSON Schema 生成

将 Valibot Schema 转换为 VSCode `contributes.configuration.properties` 格式：

```typescript
import * as v from 'valibot';
import { valibotToVscodeConfig } from '@cyia/vscode-valibot-config';
import { asVirtualGroup } from '@piying/valibot-visit';

const schema = v.object({
  name: v.pipe(v.string(), v.description('用户名')),
  role: v.pipe(
    v.picklist(['admin', 'user']),
    v.metadata({
      enumOptions: [
        { label: '管理员', description: '完全访问权限' },
        { label: '普通用户', description: '有限访问权限' },
      ],
    }),
  ),
});

const jsonSchema = valibotToVscodeConfig(schema, {
  title: '我的扩展配置',
  prefix: 'myExtension',
  id: 'myExtension.schema.json',
  order: 1,
});
```

### 写入 `package.json`

使用 `writePackageJsonConfig` 将配置自动写入 VS Code 扩展的 `package.json` 文件：

```typescript
import * as v from 'valibot';
import { writePackageJsonConfig } from '@cyia/vscode-valibot-config';

const schema = v.object({
  apiKey: v.string(),
  maxRetries: v.pipe(v.number(), v.minValue(1), v.maxValue(10)),
});

// 写入文件
const writer = writePackageJsonConfig(schema, {
  title: '我的扩展配置',
  prefix: 'myExtension',
});
await writer('./package.json');
// 生成的 package.json 中会自动添加:
// "contributes": {
//   "configuration": {
//     "title": "我的扩展配置",
//     "properties": {
//       "myExtension.apiKey": { "type": "string" },
//       "myExtension.maxRetries": { "type": "number" }
//     }
//   }
// }

// 或者直接操作对象
const packageJson = {
  name: 'my-extension',
  contributes: {} as any,
};
writer(packageJson);
```

### 高级选项

#### 使用 `metadata` 增强 UI

```typescript
const schema = v.object({
  mode: v.pipe(
    v.picklist(['fast', 'balanced', 'quality']),
    v.metadata({
      isOptional: true,
      enumOptions: [
        { label: '快速', description: '最佳性能' },
        { label: '均衡', description: '平衡权衡' },
        { label: '质量', description: '最佳输出质量' },
      ],
    }),
  ),
});
```

#### 虚拟分组

intersect内的object会被合并,允许嵌套合并

```typescript
import { asVirtualGroup } from '@piying/valibot-visit';

const schema = v.object({
  network: v.pipe(
    v.intersect([
      v.object({ proxy: v.string() }),
      v.object({ timeout: v.number() }),
    ]),
    asVirtualGroup(),
  ),
});
```
