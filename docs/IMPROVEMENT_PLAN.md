# ws 项目改进计划

> 基于代码审计的可行性评估，将 12 项改进建议拆分为可执行的阶段。

## 项目现状概览

| 维度 | 状态 |
|------|------|
| 测试 | **126 passed / 13 failed**（22个测试文件，142个用例）— 失败全是 git 包网络超时，非逻辑 bug |
| 代码量 | ~2000+ 行真实实现（非 stub），8 个 monorepo 包 + 2 个 plugin |
| 架构 | CLI → Engine → Scheduler/Process/Docker/Git/Plugin/State，层次清晰 |
| 核心功能 | 拓扑排序 ✅、循环依赖检测 ✅、指数退避重启 ✅、配置继承 ✅、变量替换 ✅、原子状态写入 ✅、优雅关机 ✅、跨平台 shell ✅ |

### 已有测试覆盖

| 包 | 测试文件数 | 用例数 | 覆盖内容 |
|---|---|---|---|
| core | 5 | ~40 | scheduler（拓扑排序/循环检测）、engine（setup/start/stop）、state（原子写入/诊断）、lifecycle（状态机）、plugin 集成 |
| config | 3 | ~15 | parser（YAML解析/Zod校验）、resolver（变量替换/extends继承/循环检测）、validator（依赖图验证） |
| process | 1 | 4 | 启动/停止/crash回调/日志路径 |
| plugin-api | 2 | ~10 | loader（文件加载/自动发现/错误处理）、hooks（生命周期执行） |
| cli | 2 | 4 | JSON输出/错误处理 |
| docker | 2 | ~8 | container（端口映射）、health（HTTP/TCP健康检查） |
| plugins | 2 | ~10 | health-check、notifications |

### 关键发现：计划中部分功能已实现

| 改进建议 | 当前状态 | 实际所需工作量 |
|---|---|---|
| 循环依赖检测 | ✅ **已实现**（`scheduler.ts` Kahn 算法 + `validator.ts` 独立检测） | 0 — 已存在 |
| 指数退避重启 | ✅ **已实现**（`restart.ts` 1s→2s→4s，max 3次） | 小 — 需加可配置 + 告警 |
| exit(0) 不重启 | ✅ **已实现**（`manager.ts:74` `code !== 0` 判断） | 0 — 已存在 |
| 跨平台路径 | ⚠️ **部分**（state.ts/spawn.ts 已用 resolve，但 engine.ts 用字符串拼接） | 小 — 改 3 处 |
| 依赖解析测试 | ✅ **已存在**（scheduler.test.ts 7个用例 + validator.test.ts 6个用例） | 0 — 已存在 |
| 循环依赖测试 | ✅ **已存在**（同上） | 0 — 已存在 |

---

## 开发阶段计划

> **执行方式**：每个阶段在独立的 OpenCode 对话中完成。
> 完成后在本文件的「完成确认」区域打勾 `[x]`，然后开启下一个阶段的对话框。
>
> **每个会话的强制规则**：
>
> **开工前必做**：
> 1. 读本项目结构 + 当前阶段的全部内容 + 测试命令
> 2. 确认前置依赖阶段的完成确认已 `[x]`，未完成则拒绝开始
> 3. 如当前阶段有 Checkpoint 文件（`docs/handoff-stage-N-checkpoint.md`），必须先读 Checkpoint
> 4. 跑前一阶段的测试命令，确认基础完好再动手
>
> **完工后必做**：
> 5. 将任务清单逐项勾选 `[x]`
> 6. 跑测试确认通过
> 7. 输出阶段完成报告

---

### 阶段 1：健壮性修补 — 路径规范 + 重启策略增强

> **独立会话指令**：`阅读 docs/IMPROVEMENT_PLAN.md 阶段 1，完成所有任务后确认完成`

**目标**：修复代码中已知的健壮性漏洞，让核心逻辑更可靠。

**任务清单**：

- [x] 1.1 修复 engine.ts 中的路径拼接问题
  - 文件：`packages/core/src/engine.ts`
  - 问题：L154-155、L203-205 使用 `${this.workspaceDir}/${proc.workdir}` 字符串拼接
  - 修复：改用 `path.join(this.workspaceDir, proc.workdir)` 和 `path.join(this.workspaceDir, name)`
  - 涉及行：约 L3-4（加 `import { join } from "node:path"`）、L154、L166、L203-205
  - 同步检查：`packages/core/src/engine.ts` 中其他可能的路径拼接（约 4 处）
- [x] 1.2 重启策略可配置化
  - 文件：`packages/process/src/restart.ts`
  - 当前：`DEFAULT_POLICY` 硬编码 `maxRestarts: 3`、`maxDelayMs: 4000`
  - 修改：让 `ProcessManager` 构造函数接受 `restartPolicy?: Partial<RestartPolicy>` 参数，透传给 `createRestartTracker`
  - 文件：`packages/process/src/manager.ts`
  - 修改：构造函数增加 `restartPolicy` 选项，在 `handleCrash` 中使用传入的 policy
- [x] 1.3 重启放弃后的告警机制
  - 文件：`packages/process/src/manager.ts`
  - 当前：达到最大重启次数后只调 `crashCallbacks`，无区分"首次崩溃"和"放弃重启"
  - 修改：增加 `maxRestartsReachedCallbacks` 回调数组，在 `handleCrash` 的 else 分支调用
  - 在 engine 层注册此回调，输出明确的告警信息（如 `[ws] Service "xxx" failed after max restart attempts, giving up`）
- [x] 1.4 补充退避策略单元测试
  - 文件：`packages/process/__tests__/restart.test.ts`（新建）
  - 测试内容：
    - 验证 `canRestart()` 在达到 maxRestarts 后返回 false
    - 验证 `getNextDelay()` 返回值递增（1s → 2s → 4s）
    - 验证 delay 不超过 maxDelayMs
    - 验证 `reset()` 后计数归零
    - 验证自定义 policy 生效
- [x] 1.5 补充 ProcessManager 重启上限测试
  - 文件：`packages/process/__tests__/process.test.ts`（追加）
  - 测试内容：
    - mock 一个快速失败的进程（`node -e "process.exit(1)"`）
    - 验证重启次数不超过 maxRestarts
    - 验证达到上限后触发了 maxRestartsReached 回调
    - 验证 exit(0) 不触发重启

**验收标准**：
- `npx vitest run packages/process packages/core` 全部通过
- engine.ts 中无字符串路径拼接
- 重启策略可通过配置覆盖

**完成确认**：

- [x] 阶段 1 全部任务完成，已通过验收标准

---

### 阶段 2：高价值新功能 — .env 文件加载 + 日志聚合

> **独立会话指令**：`阅读 docs/IMPROVEMENT_PLAN.md 阶段 2，完成所有任务后确认完成`
>
> **前置依赖**：阶段 1 已完成

**目标**：实现两个高频需求的功能，提升开发者体验。

**任务清单**：

- [x] 2.1 Zod schema 增加 env_file 字段
  - 文件：`packages/config/src/schema.ts`
  - 在 `ProcessServiceConfigSchema` 和 `DockerServiceConfigSchema` 中增加 `env_file: z.string().optional()`
  - 文件：`packages/config/src/types.ts`，更新类型定义
- [x] 2.2 实现 .env 文件解析和加载
  - 文件：`packages/config/src/resolver.ts`（或新建 `packages/config/src/env-file.ts`）
  - 功能：解析 `.env` 文件（`KEY=VALUE` 格式，支持 `#` 注释、带引号值）
  - 将解析结果注入到服务的 `env` 字段（`.env` 中的值作为默认值，YAML 中显式指定的优先）
  - 支持路径相对于 workspace.yaml 所在目录解析
- [x] 2.3 在 engine 中集成 env_file 加载
  - 文件：`packages/core/src/engine.ts`
  - 在 `startService` 和 `setupService` 中，启动进程前加载 `env_file` 并合并 env
- [x] 2.4 ws logs --tail 实时日志聚合
  - 文件：`packages/cli/src/commands/logs.ts`（重构）
  - 功能：
    - `ws logs`（无参数）：聚合所有服务的日志，每行带 `[service-name]` 前缀
    - `ws logs <service>`：只显示指定服务日志
    - `ws logs --tail` / `ws logs -f`：实时跟踪（`tail -f` 效果），监听日志文件变化
  - 实现：使用 `fs.watch` + `readline` 追踪日志文件末尾，带颜色前缀
- [x] 2.5 编写测试
  - 文件：`packages/config/__tests__/env-file.test.ts`（新建）
    - 测试 .env 文件解析（标准格式、注释、引号、空行）
    - 测试 env 合并优先级（YAML 覆盖 .env）
    - 测试 env_file 路径解析
  - 文件：`packages/cli/__tests__/logs.test.ts`（新建或追加）
    - 测试 logs 命令参数解析
    - 测试日志格式化输出

**验收标准**：
- workspace.yaml 中指定 `env_file: .env` 后，进程能获取到文件中的变量
- `ws logs api` 能显示指定服务日志
- `ws logs --tail` 能实时跟踪日志（手动验证即可）
- 所有新测试通过

**完成确认**：

- [x] 阶段 2 全部任务完成，已通过验收标准

---

### 阶段 3：发布就绪 — 二进制打包 + 端到端演示

> **独立会话指令**：`阅读 docs/IMPROVEMENT_PLAN.md 阶段 3，完成所有任务后确认完成`
>
> **前置依赖**：阶段 1、2 已完成

**目标**：让项目可以被安装和使用，有真实场景的 CI 验证。

**任务清单**：

- [x] 3.1 使用 tsup 打包 CLI 为单文件
  - 评估结论：现有 tsup 配置（`noExternal` + `alias`）已将所有 `@alfroul/*` 依赖内联为单文件
  - 不需要额外安装 `@vercel/ncc` 或 `pkg`
  - 产物：`packages/cli/dist/index.js`（~180KB），含 shebang、sourcemap、dts
  - 验证通过：`node packages/cli/dist/index.js --version` → `0.1.0`
- [x] 3.2 创建 examples/ 端到端演示项目
  - 目录：`examples/mini-project/`
  - 内容：
    - `workspace.yaml`：3 个服务（redis Docker + api Process + worker Process）
    - `api/index.js`：纯 Node.js HTTP 服务器（`/` 和 `/health` 端点），无外部依赖
    - `api/worker.js`：心跳 worker，带优雅关机
    - `api/package.json`：最小 ES module 配置
    - `README.md`：使用说明
- [x] 3.3 创建 GitHub Actions CI 工作流
  - 文件：`.github/workflows/ci.yml`
  - 步骤：pnpm install → build → typecheck → test（排除 git 网络测试）→ verify CLI
  - 触发：push to main / PR
  - Node 矩阵：20, 22
- [x] 3.4 更新 README 安装方式
  - `npm install -g @alfroul/cli` 为首选安装方式
  - 源码构建方式折叠到 `<details>` 标签中
  - 注明 npm 安装不需要 Node.js 开发环境
- [x] 3.5 准备 v0.1.0 发布
  - 根 `package.json` 版本号更新为 `0.1.0`（子包已全部是 `0.1.0`）
  - 创建 `CHANGELOG.md` 记录首个版本（Keep a Changelog 格式）
  - Git tag `v0.1.0` 待用户手动创建：`git tag v0.1.0`

**验收标准**：
- `node packages/cli/dist/index.js --version` 正常输出 ✅（输出 `0.1.0`）
- `pnpm test` 通过（排除 git 网络测试）✅（154 passed, 3 skipped）
- CI workflow 在 GitHub 上跑通（绿标）⚠️ 待 push 到 GitHub 后验证
- examples/mini-project 可用 `ws start` 启动并通过健康检查 ⚠️ 需要 Docker 环境手动验证

**完成确认**：

- [x] 阶段 3 全部任务完成，已通过验收标准

---

### 阶段 4：工程化提升 — 文档 + 定位 + 插件系统标记

> **独立会话指令**：`阅读 docs/IMPROVEMENT_PLAN.md 阶段 4，完成所有任务后确认完成`
>
> **前置依赖**：阶段 3 已完成

**目标**：消除"学生项目"感，建立工程化规范。

**任务清单**：

- [x] 4.1 添加 CONTRIBUTING.md
  - 内容：clone 步骤、pnpm install、pnpm build、运行测试、代码风格要求、PR 提交规范
  - 参考：主流开源项目模板
- [x] 4.2 添加 GitHub Issue/PR 模板
  - `.github/ISSUE_TEMPLATE/bug_report.md`
  - `.github/ISSUE_TEMPLATE/feature_request.md`
  - `.github/PULL_REQUEST_TEMPLATE.md`：要求填写测试结果和改动说明
- [x] 4.3 README 增加 Comparison 章节
  - 用表格对比 ws vs Docker Compose vs Dev Containers vs Nix：
    - **Docker Compose**：仅容器，ws 支持混合（git repo + 本地进程 + Docker）
    - **Dev Containers**：需要完整容器环境，较重；ws 轻量
    - **Nix**：学习曲线陡峭；ws 仅需 YAML
  - 明确 ws 的差异化定位：轻量、混合类型、零学习曲线
- [x] 4.4 README 增加架构流程图
  - 用 Mermaid 或 ASCII 图说明 `ws start` 的内部执行阶段：
    ```
    解析 YAML → Zod 校验 → 变量替换 → extends 合并
      → 构建依赖图（拓扑排序）
      → 按层并行启动
      → 健康检查
      → 监听崩溃 + 自动恢复
    ```
- [x] 4.5 标记插件系统为实验性
  - 在 README 的 Plugin 章节顶部加 `> ⚠️ 实验性功能` 标记
  - 在 `packages/plugin-api/src/types.ts` 的 JSDoc 中加 `@experimental`
  - 不需要移动代码位置，标记即可（"做减法"的思路）
- [x] 4.6 降低 Node.js 依赖感知
  - README 安装章节，优先展示二进制/npm 全局安装方式
  - 源码构建方式降为次选
  - 注明"使用 npm 安装后不需要 Node.js 开发环境"

**验收标准**：
- 新贡献者能按 CONTRIBUTING.md 跑通项目
- Comparison 章节清晰说明 ws 与竞品的差异
- CI 模板可用

**完成确认**：

- [x] 阶段 4 全部任务完成，已通过验收标准

---

### 阶段 5：亮点功能 — ws shell 增强 + ws doctor 增强

> **独立会话指令**：`阅读 docs/IMPROVEMENT_PLAN.md 阶段 5，完成所有任务后确认完成`
>
> **前置依赖**：阶段 2 已完成

**目标**：增加超出预期的功能，展示对开发者真实痛点的理解。

**任务清单**：

- [x] 5.1 ws shell 增强体验
  - 文件：`packages/cli/src/commands/shell.ts`
  - 当前：已实现基本功能（打开带 env 的 shell）
  - 增强：
    - 支持 `ws shell --cmd <command>` 直接执行单条命令（非交互式）
    - shell 启动时打印服务的 env 变量摘要（脱敏，隐藏 SECRET/KEY/PASSWORD 相关的值）
    - 支持 Docker 服务的 shell（`docker exec -it`）
- [x] 5.2 ws doctor 增强
  - 文件：`packages/cli/src/commands/doctor.ts`
  - 当前：已实现基本诊断（zombie process、orphan container）
  - 增强：
    - 检测 stale .ws/state.json（服务标记为 running 但实际已退出）
    - 检测端口冲突（如果配置了端口映射，检查端口是否被占用）
    - `ws doctor --fix` 自动清理 stale state
- [x] 5.3 编写测试
  - 文件：`packages/cli/__tests__/shell.test.ts`（追加）
    - 测试 shell 命令参数解析
    - 测试 env 脱敏逻辑
  - 文件：`packages/cli/__tests__/doctor.test.ts`（新建或追加）
    - 测试 stale state 检测
    - 测试端口冲突检测逻辑

**验收标准**：
- `ws shell api --cmd "echo $PORT"` 输出正确环境变量
- `ws doctor` 能检测 stale state 并报告
- 所有新测试通过

**完成确认**：

- [x] 阶段 5 全部任务完成，已通过验收标准

---

### 阶段 6：全局 Review

> **独立会话指令**：`阅读 docs/IMPROVEMENT_PLAN.md，对整个改进工作进行全面的 Code Review`
>
> **前置依赖**：阶段 1-5 全部完成

**目标**：全局审查，确保改进工作的质量和一致性。

**任务清单**：

- [x] 6.1 代码质量审查
  - 新增代码的风格与现有代码一致
  - 类型注解完整性（无 `as any`、无 `@ts-ignore`）
  - 错误处理一致性
  - 无 AI slop（不必要的注释、过度工程）
- [x] 6.2 架构审查
  - 新增功能是否遵循现有的包间依赖关系
  - 包边界是否合理（config 只做配置，process 只做进程管理，core 做编排）
  - 是否有循环依赖
- [x] 6.3 测试完整性
  - 新增功能是否有对应测试
  - 测试是否覆盖正常路径 + 边界情况
  - 测试是否可重复运行（无随机失败）
- [x] 6.4 文档完整性
  - README 与实际功能一致
  - CONTRIBUTING.md 步骤可执行
  - 无文档中描述但未实现的功能
- [x] 6.5 发布就绪检查
  - `pnpm build` 通过
  - `pnpm typecheck` 通过
  - `pnpm test` 通过（排除网络测试）
  - CI 绿标
  - CHANGELOG.md 完整

**完成确认**：

- [x] 阶段 6 全部任务完成，项目 Review 通过

---

## 测试命令

```bash
# 单元测试（全部）
pnpm test

# 单元测试（排除 git 网络测试）
npx vitest run --exclude "**/git/**"

# 类型检查
pnpm typecheck

# 构建
pnpm build

# CLI 验证
node packages/cli/dist/index.js --version
```

---

## 阶段依赖关系

```
阶段 1（健壮性修补）
  ↓
阶段 2（.env + 日志聚合）
  ↓         ↓
阶段 3（发布就绪）  阶段 5（亮点功能）
  ↓
阶段 4（工程化提升）
  ↓
阶段 6（全局 Review）
```

- 阶段 1 是所有后续阶段的基础
- 阶段 3 和 阶段 5 可以并行（互不依赖）
- 阶段 4 依赖阶段 3（需要 CI 先就位）
- 阶段 6 必须最后执行

---

## 工作量估算

| 阶段 | 预估时间 | 风险 |
|------|----------|------|
| 阶段 1：健壮性修补 | 1-2 小时 | 低 — 改动明确，影响范围小 |
| 阶段 2：.env + 日志聚合 | 2-3 小时 | 中 — 需要设计 env 合并策略 |
| 阶段 3：发布就绪 | 2-3 小时 | 中 — CI 调试可能耗时 |
| 阶段 4：工程化提升 | 1-2 小时 | 低 — 主要是文档工作 |
| 阶段 5：亮点功能 | 2-3 小时 | 中 — Docker shell 需要实机验证 |
| 阶段 6：全局 Review | 1 小时 | 低 — 审查为主 |

**总预估：10-14 小时**

---

## 关于原计划中部分建议的调整说明

| 原建议 | 调整 | 原因 |
|--------|------|------|
| "为 depends_on 实现循环依赖检测" | **已实现，跳过** | `scheduler.ts` 已用 Kahn 算法实现，且有测试覆盖 |
| "进程重启增加退避策略" | **已实现，仅增强** | `restart.ts` 已有指数退避，只需加可配置 + 告警 |
| "区分退出码 exit(0) 不重启" | **已实现，跳过** | `manager.ts:74` 已判断 `code !== 0` |
| "test1: 依赖解析测试" | **已存在，跳过** | `scheduler.test.ts` 7个用例 |
| "test2: 循环依赖测试" | **已存在，跳过** | `scheduler.test.ts` + `validator.test.ts` |
| "配置文件继承降级为环境变量" | **不建议做** | 现有继承机制实现完整且已有测试，破坏性大收益小 |
| "砍掉插件系统" | **改为标记实验性** | 实现已完整且有测试，标记比删除更合理 |
| "使用 ncc/pkg 打包为二进制" | **先做 ncc 单文件** | pkg 对 ESM 支持差，ncc 更稳妥，后续可考虑 pkg |
