# VSCode Toolkit

<div align="center">

🌐 [English](./README.md) | [中文](README.zh-CN.md)

</div>

VS Code 扩展开发设计的工具集合。

## 子包

| 子包                                                    | 描述                                      | 文档                                                                                      |
| ------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| [@cyia/vscode-trpc](packages/trpc/)                     | VS Code 扩展与 Webview 之间 tRPC 通信集成 | [EN](packages/trpc/README.md) · [中文](packages/trpc/README.zh-CN.md)                     |
| [@cyia/vscode-valibot-config](packages/valibot-config/) | 基于 Valibot Schema 的 VSCode 配置管理器  | [EN](packages/valibot-config/README.md) · [中文](packages/valibot-config/README.zh-CN.md) |

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm run build

# 运行测试
pnpm run test
```
