# MergeWarden

[![Release](https://img.shields.io/github/v/release/sjh9714/mergewarden?label=release)](https://github.com/sjh9714/mergewarden/releases)
[![CI](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/sjh9714/mergewarden)](LICENSE)

[English](README.md) · 简体中文

在开始代码审查前，先看哪些 PR 缺少必要背景。

粘贴一个公开 GitHub 仓库。MergeWarden 会列出缺少 issue 链接、描述过短、
未使用模板和改动过大的 PR。不需要登录，也不使用 AI。

## 查看公开仓库的审查队列

[**打开公开审查队列**](https://sjh9714.github.io/mergewarden/)

粘贴 `owner/repository` 或完整的 GitHub 仓库 URL。浏览器读取最近三十个
开放 PR 的摘要，排除可信仓库角色和已知维护机器人，然后读取最多十个
外部 PR 的详细信息。

队列按维护者在阅读代码前需要确认的确定性事实排序。

| 事实           | 含义                                     |
| -------------- | ---------------------------------------- |
| 没有关联 issue | 正文没有 issue 编号、URL 或关闭关键词    |
| 描述过短       | 正文中的有效说明少于 80 个字符           |
| 未使用模板     | 仓库有可见的 PR 模板结构，但正文没有保留 |
| 改动过大       | 超过 50 个文件或 1,500 行改动            |

首次贡献只作为背景显示，不参与评分。MergeWarden 不会把贡献称为垃圾、
低质量或 AI 生成，也不会自动关闭、加标签、评分或评论。

网页队列只读取公开元数据和 base 分支的 PR 模板。它不读取改动文件内容，
不执行代码，没有后端，也不保存目标。

需要更大的已认证队列时使用 CLI。

```bash
GH_TOKEN=... npx --yes mergewarden@0.10.4 triage owner/repository
```

## 运行详细 PR 风险检查

同一页面也接受完整 PR URL 或 `owner/repository#number`。每个队列条目都
链接到这个详细检查。

详细检查关注四类安全边界。

| 检查             | 需要复核的改动                                             |
| ---------------- | ---------------------------------------------------------- |
| 工作流权限       | 工作流获得写权限、使用危险触发器或引用可移动的 Action 版本 |
| 智能体指令       | PR 修改 `AGENTS.md`、`CLAUDE.md`、`.mcp.json` 等控制文件   |
| 不可信提示词输入 | PR 文本进入工作流中的智能体提示词                          |
| 安装脚本         | 包清单新增或修改安装阶段的生命周期脚本                     |

不用克隆目标仓库也能从终端运行同一个检查。

```bash
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

## 添加 Action

Action 自动运行详细 PR 风险检查，不会自动排序审查队列。

新建 `.github/workflows/mergewarden.yml`。

```yaml
name: MergeWarden PR Risk Check

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  mergewarden:
    runs-on: ubuntu-latest
    steps:
      - uses: sjh9714/mergewarden@v0.10.4
        with:
          comment: auto
```

`comment: auto` 在没有可操作结果时保持安静，有结果时只更新同一条评论。
现有 Action 默认行为没有改变。

## 安全边界

- 网页直接访问公开 GitHub API，没有遥测。
- 队列读取元数据和一个 base 分支模板。详细检查只读取确定性规则需要的文件。
- 网页和 Action 都不会执行或检出 PR 代码。
- 策略来自准确的 base commit，不信任 PR head 中的策略文件。
- 分析不调用大模型。
- 证据不完整时明确显示不完整，绝不会显示为通过。

完整边界见[安全模型](docs/security-model.md)和[证据模型](docs/evidence-model.md)。

## 证据与高级接口

[Triage 是否有帮助](docs/study/does-triage-help.md)记录了现有队列测量及其主要限制。
它测量的是队列能否区分 PR，不是维护者是否节省了时间。在维护者确认价值前，
当前网页队列仍然是产品实验。

[文档索引](docs/README.md)包含配置、Action、CLI、工具集成、可复现研究和
[MCP server](packages/mcp/README.md)。

## 参与贡献

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

每条新规则都需要通过样例、失败样例和报告快照。详情见[贡献指南](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
