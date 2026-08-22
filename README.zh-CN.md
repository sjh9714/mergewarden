# MergeWarden

[![Release](https://img.shields.io/github/v/release/sjh9714/mergewarden?label=release)](https://github.com/sjh9714/mergewarden/releases)
[![CI](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/sjh9714/mergewarden/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/sjh9714/mergewarden)](LICENSE)

[English](README.md) · 简体中文

粘贴一个 GitHub PR，马上看到哪些改动值得人工复核。MergeWarden 检查工作流权限、
智能体指令、不可信提示词输入和安装脚本。它使用确定性规则，不检出分支，也不调用大模型。

## 扫描公开 PR

[**打开公开 PR 扫描器**](https://sjh9714.github.io/mergewarden/)

粘贴完整的 GitHub PR URL 或 `owner/repository#number`。扫描直接在浏览器里运行，
不需要登录或令牌，也不会执行代码。

## 一个真实结果

[这个公开 PR](https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/22)
看起来只是单行文档修改，但它改动了 `CLAUDE.md`。这个文件会影响仓库里后续的智能体运行。

```text
1 change deserves review

Agent control-plane file changed
CLAUDE.md

This file can change how AI agents behave in future PRs.
What to check
Review the control-plane change before merging.
```

MergeWarden 指出文件和复核问题，不评价作者，也不尝试做通用代码审查。

## 四类重点检查

| 检查             | 值得复核的改动                                                     |
| ---------------- | ------------------------------------------------------------------ |
| 工作流权限       | 工作流获得写权限、使用危险触发器或引用可移动的 Action 版本         |
| 智能体指令       | PR 修改 `AGENTS.md`、`CLAUDE.md`、`.mcp.json` 或其他智能体控制文件 |
| 不可信提示词输入 | PR 标题、正文等不可信文本进入工作流中的智能体提示词                |
| 安装脚本         | 包清单新增或修改安装阶段的生命周期脚本                             |

[配置参考](docs/configuration.md)列出了每条确定性规则和严重级别。

## 从 CLI 扫描

不用克隆仓库也能从终端扫描同一个公开 PR。

```bash
npx --yes mergewarden@0.10.4 scan https://github.com/owner/repository/pull/123
```

私有仓库或更高 API 速率限制需要 `GH_TOKEN`。令牌只通过环境变量读取，
避免进入 shell 历史。`--format` 可以输出 JSON 或 Markdown。

## 添加 Action

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
现有 Action 用户的默认评论行为没有改变。

需要不可变安装时请固定 release commit。MergeWarden 不发布也不建议使用可移动的 `v0` 标签。

## 安全边界

- 网页扫描器只直接访问公开 GitHub API，没有后端、数据库、账户或遥测。
- 网页扫描器和 Action 都不会执行 PR 代码，也不会检出任何分支。
- 策略来自准确的 base commit，不信任 PR head 中的策略文件。
- 分析不调用大模型，相同证据会得到相同 finding ID 和 policy digest。
- 证据不完整时明确显示不完整，绝不会显示为通过。

完整边界见[安全模型](docs/security-model.md)和[证据模型](docs/evidence-model.md)。

## 研究与高级接口

[公开研究](docs/study/what-2204-agent-prs-showed.md)记录了默认规则在 2,204 个
已合并智能体 PR 中发现的结果。使用扫描器不需要先阅读研究。

[文档索引](docs/README.md)包含配置、Action、CLI、工具集成和可复现研究。
高级接口仍然保留，包括检查整个仓库队列的 [`triage`](docs/triage.md) 和
在 PR 出现前检查智能体工作的 [MCP server](packages/mcp/README.md)。

## 参与贡献

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

每条规则都需要通过样例、失败样例和报告快照。详情见[贡献指南](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
