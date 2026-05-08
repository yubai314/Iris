# Iris

**in-app runtime interface for semantic control**

一种介于 MCP 与原生 CLI 之间的应用内语义控制协议插件。

---

大多数让 LLM 操控桌面应用的方案，本质上是在教模型看图说话——截图、识别像素、猜按钮在哪、模拟鼠标点击、再截图确认。每一步都是猜测，每一步都要等待，UI 改版就得从头来过。

Iris 的出发点不同。

现代桌面应用的每一次用户操作，最终都不是"点了某个像素"，而是触发了一个结构化调用，经过 IPC 通道落在后端 handler 上。这个调用是有类型的、有参数的、有语义的。它早就在那里了。

Iris 的核心主张只有一句话：

> **agent 应该只做用户能做的操作，只是速度更快、可以自动化。**

它不截图，不猜坐标，不绕过业务逻辑。它帮助开发者用最少的改动，让自己的应用达到 Obsidian CLI 那样的状态——内置完整的 agent 控制能力，无需对外暴露接口，无需接入任何外部生态。开发者可以只允许自己的内置 agent 使用，完全私有。

第一版以 Tauri 2 为参考实现，随后适配 Electron。实现语言 TypeScript-first，平台差异通过 adapter 隔离。

---

## 名字

Iris 这个名字有三层含义，从外到内依次深入。

### 1. Iris，信使女神

在古希腊神话里，Iris 是唯一能在诸神与人类之间自由穿行的信使。她不创造意志，也不做决定——她只是那条连接两个世界的可靠路径。

这正是 Iris 在协议层扮演的角色：它站在 agent runtime 和桌面应用之间，把自然语言任务转译成应用内部真实存在的语义操作，把状态变化反馈给 agent。它不替 agent 做决定，也不替应用重写逻辑。它是一条忠实的通道。

### 2. iris，虹膜

虹膜是眼睛里调节光线的结构。它不决定你看什么，但决定你怎么看——以什么精度、什么边界、什么对比度。

对 agent 来说，Iris 扮演类似的感知边界角色。传统 Computer Use 依赖截图，agent 看到的是压扁后的像素，没有结构，没有语义，没有层次。Iris 让 agent 看到的是更接近应用真实世界的模型：

- 渲染树中的可见文字、组件 ID 和语义标注
- readable 命令返回的结构化业务状态
- 被过滤后的 domain 事件流，去掉所有 UI 噪声

不是更多截图，而是更干净的感知。

### 3. iris，鸢尾花色的提示光

当 agent 正在操控某个 UI 组件，组件周围会出现一圈彩色提示光——像鸢尾花那样，蓝紫色渐变，有辨识度，围绕视觉焦点。

这不是装饰。它是人机协同的核心机制：

- 用户知道 agent 正在动哪里
- agent 操作和用户手动操作在审计中可以区分
- 高风险或冲突状态可以被及时暂停
- 每一次写操作都对应一个可回溯的 commit

Iris 不追求让 agent 悄悄接管应用。它让 agent 的行动在界面中可见、可理解、可撤回。

---

## 三层 Computer Use 理论

我们把 LLM 操控软件的方式分成三层。

### Layer 0：外部视觉控制

```
截图 → 视觉模型 → 坐标 → 鼠标模拟 → 再截图确认
```

优点是适配成本几乎为零。缺点也很明显：每步都需要截图和推理，单步延迟 2-5 秒；批量操作（比如整理 50 张卡片）要几分钟；UI 改版即失效；agent 只能看到视口内的内容；操作语义来自模型猜测，不是应用声明；误操作没有结构化回滚。

这条路适合通用桌面控制，不适合成为高可靠应用内 agent 的主路径。

### Layer 1：应用内语义控制（Iris 所在位置）

```
用户点击按钮 → 前端事件 → IPC command → 后端业务逻辑
agent action  → Iris executor → 同一个 IPC command → 同一个后端业务逻辑
```

agent 走真实业务路径，不绕过校验，不猜坐标。操作参数是结构化的，可读状态和可写操作由应用声明，每次写操作可以生成 commit，用户操作和 agent 操作在审计中可区分，UI 改版不影响命令语义。

Layer 1 的安全性不靠策略，靠架构——agent 只能调用被显式暴露的命令，天然是用户操作能力的子集。

### Layer 2：数据层直写

让 agent 直接调用数据库、内部 service 或云端 REST API。效率最高，风险也最高——agent 可能绕过 UI 层和业务层的校验、权限和审计语义。

更隐蔽的风险是身份归属。飞书、钉钉这类工作台 CLI 支持以用户 OAuth token 执行操作（`--as user`），即以用户本人的身份代劳。这意味着审计日志里显示的是用户本人，但实际决策者是 LLM。出了事，责任边界模糊。Iris 天然没有这个问题——agent 走独立通道，身份是"agent"，与用户操作完全分离，两个 actor 在 commit 历史中清晰可辨。

Iris 的判断是：前后端分离 GUI 应用的 agent 主路径应该是 Layer 1。Layer 0 可以作为兜底，Layer 2 可以作为特权能力，但不应该替代应用内语义控制。

---

## 适用边界

Iris 第一阶段的清晰边界：

```
前端      Web UI / DOM / React / Vue / Svelte 等
后端      通过 IPC、command、handler 承接业务逻辑
运行时    Tauri 2、Electron 或类似前后端分离 WebView shell
语言      TypeScript-first
```

大量现代桌面应用本质上都是前后端分离的 Web app，只是跑在桌面壳里。Iris 优先服务这类应用。

第一版适配顺序：

```
1. Tauri 2    参考实现
2. Electron   后续适配
3. 其他 WebView shell（更远期）
```

Flutter、Qt、原生 macOS/Windows 需要重新处理渲染树和可访问性树，属于更远期研究方向，不进入第一阶段。

---

## Iris Kit 包含什么

Iris 由三层组成：

```
Iris Protocol   开发者声明应用语义能力的标准
Iris Plugin     装进宿主应用的运行时，首先实现 Tauri 2 adapter
Iris Harness    让不同 agent 接入 Iris 的执行壳与调试环境
```

### 包结构

```
@iris/protocol   协议类型、manifest、action、commit、policy
@iris/core       command registry、schema、executor、history
@iris/tauri      Tauri adapter
@iris/electron   Electron adapter（后续）
@iris/react      snapshot、overlay、provider
@iris/harness    开发调试用 agent runner
@iris/devtools   manifest、event、commit、policy 调试面板
```

### Protocol Core

协议核心定义所有平台共享的数据模型：

```
IrisManifest   当前应用暴露给 agent 的能力清单
IrisCommand    readable / writable 命令描述
IrisEvent      domainState 事件描述
IrisAction     agent 请求执行的动作
IrisWorld      渲染快照 + 结构化状态合成后的世界模型
IrisCommit     一次 writable 操作生成的可回滚记录
IrisPolicy     ban list、redaction、confirm rule 等运行时策略
IrisError      标准错误码
```

### Command Registry

命令分为两类：

```
readable   只读命令，无副作用，用于构建世界模型
writable   写入命令，有副作用，每次执行生成 commit
```

只读命令：

```ts
import { defineIrisApp, readable, z } from "@iris/core";

export const iris = defineIrisApp({
  platform: "tauri",
  commands: {
    listItems: readable({
      invoke: "list_items",
      description: "获取当前工作区中的项目",
      args: z.object({}),
      returns: z.array(ItemSchema),
    }),
  },
});
```

写入命令需要回答三个问题：改什么资源、风险有多高、如何撤回。

可逆操作：

```ts
moveItem: writable({
  invoke: "move_item",
  description: "将项目移动到指定位置",
  resource: "item",
  risk: "reversible",
  revertable: true,
  args: z.object({
    id: z.string(),
    target: z.string(),
  }),
  undo: inverse("move_item"),
}),
```

不可撤回的操作必须显式声明，且默认要求用户确认：

```ts
purgeBookmark: writable({
  invoke: "purge_bookmark",
  description: "永久删除书签",
  resource: "bookmark",
  risk: "irreversible",
  revertable: false,
  confirm: "required",
  args: z.object({ id: z.string() }),
}),
```

**revertable 的默认值是 `false`**——开发者必须显式声明操作是可逆的，Iris 才会自动记录 undo 策略。这是保守原则：宁可多确认，不要默认承诺无法兑现的撤回。

缺省规则：

```
没有 undo 声明的 writable，不允许静默执行
没有 risk 声明的 writable，按中风险处理
命令名包含 delete / remove / send / pay / purge 等，DevTools 自动提示补充声明
```

### Runtime Executor

executor 是 agent action 的唯一入口：

- 检查命令是否在 manifest 中
- 校验参数 schema
- 应用 ban list 和 confirm rule
- 检查资源版本，防止并发冲突（`STATE_CONFLICT`）
- 执行前创建 snapshot
- 调用真实 IPC 命令
- 执行后记录 diff，生成 commit
- 支持 idempotency key，防止重试导致重复执行

agent 不直接调用任意 IPC，而是通过 executor 进入应用。

### Snapshot System

两个状态来源，共同构成 `IrisWorld`：

**渲染快照（前端）**：可见文字、组件 ID、role、bounds、enabled/disabled 状态。回答"用户现在能看到什么"。

**结构化状态（readable 命令）**：不受视口限制的全量业务数据，包含稳定 id 和操作锚点。回答"agent 可以用哪些字段执行操作"。

资源带版本号，支持并发冲突检测：

```
resource id
resource version
updated_at
```

### Event Stream

严格区分两类状态变化：

```
uiState       动画、loading、hover、展开收起——不进入 agent 事件流
domainState   项目移动、文档保存、任务完成——推送给 agent
```

开发者只需标注哪些 emit 是业务事件，其余自动过滤。

### Commit History

每次 writable 操作产生一条 commit：

```json
{
  "commitId": "commit_003",
  "command": "move_item",
  "args": { "id": "item_042", "target": "later" },
  "snapshot": { "before": "...", "after": "..." },
  "revertable": true,
  "inverse": { "command": "move_item", "args": { "id": "item_042", "target": "unread" } },
  "actor": "agent",
  "timestamp": "2026-05-08T11:00:00Z"
}
```

用户可按 commit 粒度撤回，也可一键撤回整个 agent 会话。`actor` 字段区分用户操作和 agent 操作。

### Error Codes

| 错误码 | 含义 |
|---|---|
| `PERMISSION_DENIED` | 命令不在白名单或触发 ban list |
| `STATE_CONFLICT` | 资源版本不匹配，用户已手动修改 |
| `SCHEMA_INVALID` | 参数类型不符合声明 |
| `USER_CONFIRM_REQUIRED` | 高风险操作等待用户确认 |
| `APP_BUSY` | 宿主 app 当前不可安全执行 |
| `REDACTED_FIELD` | 请求访问 agent-blind 区域 |
| `RATE_LIMITED` | 写操作节流 |
| `UNSUPPORTED_COMMAND` | 命令不存在或当前平台未实现 |

---

## Tauri 第一版接入

Tauri 后端继续使用原有 Rust command，Iris 不要求改写业务逻辑。开发者只在 TypeScript 侧声明哪些命令进入 agent action space。

```ts
import { defineIrisApp, readable, writable, inverse, z } from "@iris/core";
import { tauriAdapter } from "@iris/tauri";

export const iris = defineIrisApp({
  platform: "tauri",
  adapter: tauriAdapter(),
  commands: {
    listItems: readable({
      invoke: "list_items",
      description: "获取当前工作区中的项目",
      args: z.object({}),
      returns: z.array(ItemSchema),
    }),
    moveItem: writable({
      invoke: "move_item",
      description: "将项目移动到指定位置",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ id: z.string(), target: z.string() }),
      undo: inverse("move_item"),
    }),
  },
});
```

前端侧：

```tsx
import { IrisProvider } from "@iris/react";

export function Root() {
  return (
    <IrisProvider appId="my-app">
      <App />
    </IrisProvider>
  );
}
```

IrisProvider 负责渲染树遍历快照、鸢尾光圈 overlay、commit history UI 和用户确认弹窗。

---

## 已知工程问题

这些问题不应该被藏起来，而应该直接进入协议和实现设计。

**不追求透明拦截**：第一版不自动发现并拦截所有 IPC。显式声明比透明拦截更安全，也更容易解释边界。

**回滚不是万能承诺**：发送消息、付款、硬删除远端数据无法严格撤回。能撤的记录 undo，能补偿的记录 restore payload，不能撤的必须确认。开发者不声明 undo，Iris 不假装安全。

**prompt injection 会从 UI 内容进入 agent**：渲染文字和业务状态都是不可信输入。Iris 的安全不依赖 prompt，依赖 manifest、policy、schema、confirm 和 executor。

**TS 声明和后端可能漂移**：TypeScript 声明是一份 contract。开发模式下 Iris 应做 schema probe，DevTools 标出 schema mismatch，CI 提供 `iris check`。

**manifest 可能变得太大**：支持分层能力（core / contextual / discoverable / hidden），避免重复 MCP 工具描述过多的问题。

**component id 必须稳定**：没有稳定 id 的元素可以被读取，但不应作为 writable 操作锚点。推荐标注 `data-iris-id`。

**协议版本从第一天存在**：manifest 和 commit 包含 `irisProtocolVersion`、`appSchemaVersion`、`commandVersion`，防止 command 改名或参数变化导致历史记录失效。

---

## 与现有协议的关系

Iris 是面向桌面原生应用的 AG-UI 替代方案，也是面向应用内语义控制的 MCP 替代方案。

AG-UI 解决的是 Web app 的 agent 事件流，假设应用从头按协议构建。Iris 解决的是已有桌面应用的语义控制，开发者不需要重写任何业务逻辑。对于前后端分离的桌面 GUI，Iris 是更合适的选择。

MCP 让 agent 调用外部工具，需要开发者主动暴露命令接口。Iris 的目标不同：帮助开发者快速达到 Obsidian CLI 那样的状态——应用内置完整的 agent 控制能力——而无需对外暴露任何命令。开发者可以只允许自己内置的 agent 使用这套接口，完全私有，不接入任何外部生态。

---

## Demo

**天机（Tianji）**，一个基于 Tauri 2 的桌面新闻阅读应用。三列看板：未读、稍后看、已归档。

核心验证任务：用户说"把所有科技类卡片移到稍后看"，Iris 在后台批量执行，鸢尾光圈标注正在操控的卡片，完成后用户可查看 commit 历史并一键撤回任意操作。

同样的任务用 Layer 0 Computer Use 执行需要数分钟，用 Iris 执行需要数秒。这个对比是论文的核心量化指标之一。
