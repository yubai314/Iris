<div align="center">
<img src="assets/banner.png" alt="Iris" width="660" />

<h1>Iris</h1>

<p><strong>in-app runtime interface for semantic control</strong> · a kit for in-app agent control — between MCP and native CLI</p>

<!-- Tech Stack -->
<p>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/Tauri-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri" />
<img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
<img src="https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white" alt="Zod" />
</p>

<!-- SDK / Kit positioning -->
<p>
<img src="https://img.shields.io/badge/Layer%201-In--App%20Semantic%20Control-7C3AED?style=flat-square" alt="Layer 1 In-App Semantic Control" />
<img src="https://img.shields.io/badge/SDK-Tauri%20%7C%20Electron-8B5CF6?style=flat-square" alt="SDK · Tauri | Electron" />
<img src="https://img.shields.io/badge/MCP%20%E2%86%94%20Native%20CLI-Semantic%20Bridge-6366F1?style=flat-square" alt="Between MCP and Native CLI" />
</p>

<!-- Meta -->
<p>
<img src="https://img.shields.io/github/license/yubai314/Iris?style=flat-square" alt="License" />
<img src="https://img.shields.io/github/stars/yubai314/Iris?style=flat-square" alt="Stars" />
<img src="https://img.shields.io/github/last-commit/yubai314/Iris?style=flat-square" alt="Last Commit" />
<img src="https://img.shields.io/github/repo-size/yubai314/Iris?style=flat-square" alt="Repo Size" />
</p>

<p><a href="#three-layers-of-computer-use">Features</a> · <a href="#whats-in-the-iris-kit">Packages</a> · <a href="#tauri-integration-first-version">Install</a></p>
</div>

---

Most approaches to LLM-driven desktop control are fundamentally teaching a model to read pictures — take a screenshot, identify pixels, guess where the button is, simulate a mouse click, take another screenshot to confirm. Every step is a guess. Every step requires waiting. A UI redesign means starting over.

Iris takes a different approach.

Every user action in a modern desktop app ultimately isn't "a pixel was clicked" — it triggers a structured call that travels through an IPC channel and lands on a backend handler. That call has types, parameters, and semantics. It was always there.

Iris has one core claim:

> **An agent should only do what a user can do — just faster, and automated.**

It doesn't take screenshots. It doesn't guess coordinates. It doesn't bypass business logic. It helps developers — with minimal changes — bring their app to the state of something like the Obsidian CLI: full agent control built in, no external interfaces exposed, no external ecosystem required. Developers can restrict access to their own built-in agent only, keeping it entirely private.

The first version targets Tauri 2 as the reference implementation, with Electron to follow. TypeScript-first, with platform differences isolated behind adapters.

---

## Three Layers of Computer Use

We divide LLM-driven software control into three layers.

### Layer 0: External Visual Control

```
screenshot → vision model → coordinates → mouse simulation → screenshot to confirm
```

The advantage is near-zero integration cost. The disadvantages are clear: every step requires a screenshot and inference, with 2–5 seconds of latency per step; bulk operations (reorganizing 50 cards, for example) take minutes; a UI redesign breaks everything; the agent can only see what's in the viewport; operation semantics come from model guesses, not application declarations; there's no structured rollback for mistakes.

This path suits general desktop control. It's not suitable as the primary path for a high-reliability in-app agent.

### Layer 1: In-App Semantic Control (Where Iris Lives)

```
user clicks button → frontend event → IPC command → backend business logic
agent action       → Iris executor  → same IPC command → same backend business logic
```

The agent travels the real business path — no bypassing validation, no guessing coordinates. Operation parameters are structured. Readable state and writable operations are declared by the app. Every write generates a commit. User and agent operations are distinguishable in the audit trail. A UI redesign doesn't affect command semantics.

Layer 1's security doesn't rely on policy — it relies on architecture. The agent can only call explicitly exposed commands, which are inherently a subset of what a user can do.

### Layer 2: Direct Data Layer Access

The agent calls the database, internal services, or a cloud REST API directly. Maximum efficiency, maximum risk — the agent may bypass the validation, permissions, and audit semantics of both the UI and business layers.

The more subtle risk is identity attribution. Collaboration tools like Feishu and DingTalk support executing operations with a user's OAuth token (`--as user`) — acting as the user themselves. This means the audit log shows the user, but the actual decision-maker was the LLM. When something goes wrong, accountability is murky. Iris has no such problem by design — the agent operates through a dedicated channel, its identity is "agent", completely separate from user operations, and the two actors are clearly distinguishable in the commit history.

Iris's position: the primary agent path for frontend-backend GUI apps should be Layer 1. Layer 0 can serve as a fallback; Layer 2 can serve as a privileged capability — but neither should replace in-app semantic control.

---

## Scope

Iris's clear boundaries for the first phase:

```
Frontend    Web UI / DOM / React / Vue / Svelte, etc.
Backend     Business logic served via IPC, commands, handlers
Runtime     Tauri 2, Electron, or similar frontend-backend WebView shells
Language    TypeScript-first
```

A large number of modern desktop apps are fundamentally frontend-backend Web apps running inside a desktop shell. Iris serves these first.

First-phase adapter order:

```
1. Tauri 2    Reference implementation
2. Electron   Follow-up adapter
3. Other WebView shells (further out)
```

Flutter, Qt, and native macOS/Windows require reworking the render tree and accessibility tree — these are longer-term research directions and are out of scope for the first phase.

---

## What's in the Iris Kit

Iris is composed of three layers:

```
Iris Protocol   The standard for developers to declare an app's semantic capabilities
Iris Plugin     The runtime embedded in the host app, starting with the Tauri 2 adapter
Iris Harness    The execution shell and debug environment for connecting agents to Iris
```

### Package Structure

```
@iris/protocol   Protocol types, manifest, action, commit, policy
@iris/core       Command registry, schema, executor, history
@iris/tauri      Tauri adapter
@iris/electron   Electron adapter (upcoming)
@iris/react      Snapshot, overlay, provider
@iris/harness    Agent runner for development and debugging
@iris/devtools   Debug panel: manifest, events, commits, policy
```

### Protocol Core

The protocol core defines data models shared across all platforms:

```
IrisManifest   The capability manifest exposed to the agent
IrisCommand    readable / writable command description
IrisEvent      domainState event description
IrisAction     An action requested by the agent
IrisWorld      World model composed of render snapshot + structured state
IrisCommit     A revertable record generated by a writable operation
IrisPolicy     Runtime policies: ban list, redaction, confirm rules, etc.
IrisError      Standard error codes
```

### Command Registry

Commands fall into two categories:

```
readable   Read-only commands, no side effects, used to build the world model
writable   Write commands, with side effects, each execution generates a commit
```

Read-only command:

```ts
import { defineIrisApp, readable, z } from "@iris/core";

export const iris = defineIrisApp({
  platform: "tauri",
  commands: {
    listItems: readable({
      invoke: "list_items",
      description: "Get all items in the current workspace",
      args: z.object({}),
      returns: z.array(ItemSchema),
    }),
  },
});
```

Write commands must answer three questions: what resource is being changed, how risky is it, and how can it be undone.

Reversible operation:

```ts
moveItem: writable({
  invoke: "move_item",
  description: "Move an item to the specified position",
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

Irreversible operations must be explicitly declared and require user confirmation by default:

```ts
purgeBookmark: writable({
  invoke: "purge_bookmark",
  description: "Permanently delete a bookmark",
  resource: "bookmark",
  risk: "irreversible",
  revertable: false,
  confirm: "required",
  args: z.object({ id: z.string() }),
}),
```

**`revertable` defaults to `false`** — developers must explicitly declare that an operation is reversible before Iris will automatically record an undo policy. This is the conservative principle: require more confirmations rather than making promises that can't be kept.

Default rules:

```
A writable without an undo declaration cannot be silently executed
A writable without a risk declaration is treated as medium risk
Commands containing delete / remove / send / pay / purge etc. trigger a DevTools prompt to add declarations
```

### Runtime Executor

The executor is the sole entry point for agent actions:

- Checks whether the command is in the manifest
- Validates parameter schema
- Applies ban list and confirm rules
- Checks resource version to prevent concurrent conflicts (`STATE_CONFLICT`)
- Creates a snapshot before execution
- Calls the real IPC command
- Records a diff and generates a commit after execution
- Supports idempotency keys to prevent duplicate execution on retry

Agents don't call arbitrary IPC directly — they enter the application through the executor.

### Snapshot System

Two state sources together form `IrisWorld`:

**Render snapshot (frontend):** Visible text, component IDs, roles, bounds, enabled/disabled state. Answers: "What can the user currently see?"

**Structured state (readable commands):** Full business data not limited by the viewport, containing stable IDs and operation anchors. Answers: "Which fields can the agent use to execute operations?"

Resources carry version numbers to support concurrent conflict detection:

```
resource id
resource version
updated_at
```

### Event Stream

Two categories of state change are strictly separated:

```
uiState       Animations, loading, hover, expand/collapse — excluded from the agent event stream
domainState   Item moved, document saved, task completed — pushed to the agent
```

Developers only need to mark which emits are business events; everything else is filtered automatically.

### Commit History

Every writable operation produces a commit:

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

Users can revert by individual commit, or revert an entire agent session in one click. The `actor` field distinguishes user operations from agent operations.

### Error Codes

| Code | Meaning |
|---|---|
| `PERMISSION_DENIED` | Command not in allowlist or triggered ban list |
| `STATE_CONFLICT` | Resource version mismatch — user has made a manual change |
| `SCHEMA_INVALID` | Parameter types don't match the declaration |
| `USER_CONFIRM_REQUIRED` | High-risk operation awaiting user confirmation |
| `APP_BUSY` | Host app is not currently safe to execute |
| `REDACTED_FIELD` | Attempted access to an agent-blind area |
| `RATE_LIMITED` | Write operation throttled |
| `UNSUPPORTED_COMMAND` | Command doesn't exist or is not implemented on this platform |

---

## Tauri Integration (First Version)

The Tauri backend continues to use existing Rust commands — Iris does not require rewriting any business logic. Developers only declare on the TypeScript side which commands enter the agent action space.

```ts
import { defineIrisApp, readable, writable, inverse, z } from "@iris/core";
import { tauriAdapter } from "@iris/tauri";

export const iris = defineIrisApp({
  platform: "tauri",
  adapter: tauriAdapter(),
  commands: {
    listItems: readable({
      invoke: "list_items",
      description: "Get all items in the current workspace",
      args: z.object({}),
      returns: z.array(ItemSchema),
    }),
    moveItem: writable({
      invoke: "move_item",
      description: "Move an item to the specified position",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ id: z.string(), target: z.string() }),
      undo: inverse("move_item"),
    }),
  },
});
```

On the frontend:

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

`IrisProvider` handles render-tree snapshot traversal, the iris highlight overlay, commit history UI, and user confirmation dialogs.

---

## Known Engineering Challenges

These problems shouldn't be hidden — they should be addressed directly in the SDK design.

**No transparent interception:** The first version does not automatically discover and intercept all IPC. Explicit declaration is safer than transparent interception and makes boundaries easier to explain.

**Rollback is not a universal promise:** Sending a message, making a payment, and hard-deleting remote data cannot be strictly undone. Operations that can be undone record an undo. Operations that can be compensated record a restore payload. Operations that can't be undone must require confirmation. If a developer doesn't declare an undo, Iris doesn't pretend it's safe.

**Prompt injection can enter the agent through UI content:** Rendered text and business state are untrusted input. Iris's security does not rely on prompts — it relies on the manifest, policy, schema, confirm rules, and executor.

**TypeScript declarations and the backend may drift:** TypeScript declarations are a contract. In dev mode, Iris should run a schema probe; DevTools will flag schema mismatches; CI provides `iris check`.

**Manifests can get too large:** Layered capability support (core / contextual / discoverable / hidden) avoids the problem of MCP tool descriptions becoming overly verbose.

**Component IDs must be stable:** Elements without stable IDs can be read, but should not serve as anchors for writable operations. Use `data-iris-id` annotations.

**Protocol versioning from day one:** Manifests and commits include `irisProtocolVersion`, `appSchemaVersion`, and `commandVersion` to prevent history records from becoming invalid when commands are renamed or parameters change.

---

## Relationship to Existing Tools

Iris is an SDK alternative to AG-UI for native desktop applications, and fills a different role than MCP for in-app semantic control.

AG-UI addresses the agent event stream for Web apps, assuming the application is built from scratch according to the protocol. Iris addresses semantic control for existing desktop applications — developers don't need to rewrite any business logic. For frontend-backend desktop GUIs, Iris is the more appropriate choice.

MCP lets agents call external tools, requiring developers to actively expose command interfaces. Iris has a different goal: to help developers quickly reach the state of something like the Obsidian CLI — full agent control built into the application — without exposing any commands externally. Developers can restrict access to their own built-in agent only, keeping it entirely private and outside any external ecosystem.

---

## Demo

**Tianji**, a Tauri 2-based desktop news reading app. Three-column kanban: Unread, Read Later, Archived.

Core validation task: the user says "move all tech cards to Read Later." Iris executes in the background in bulk, the iris highlight ring marks each card being manipulated, and when complete the user can view the commit history and revert any operation in one click.

The same task with Layer 0 Computer Use takes minutes. With Iris, it takes seconds. This comparison is one of the core quantitative metrics of the paper.

---

## The Name

Iris has three layers of meaning, from outside in.

### 1. Iris, Messenger Goddess

In Greek mythology, Iris was the only messenger who could travel freely between the gods and mortals. She didn't create intent or make decisions — she was simply the reliable path connecting two worlds.

This is exactly the role Iris plays at the SDK layer: it stands between the agent runtime and the desktop app, translating natural language tasks into semantic operations that genuinely exist inside the application, and feeding state changes back to the agent. It doesn't make decisions for the agent, and it doesn't rewrite the app's logic. It is a faithful channel.

### 2. Iris, the Pupil

The iris is the structure in the eye that regulates light. It doesn't decide what you see, but it decides how you see — with what precision, what boundaries, what contrast.

For an agent, Iris plays a similar role as a perceptual boundary. Traditional Computer Use relies on screenshots; the agent sees flattened pixels with no structure, no semantics, no hierarchy. Iris lets the agent see a model closer to the app's true world:

- Visible text, component IDs, and semantic annotations from the render tree
- Structured business state returned by readable commands
- A filtered domain event stream with all UI noise removed

Not more screenshots — cleaner perception.

### 3. Iris, the Violet Highlight

When an agent is manipulating a UI component, a colored highlight ring appears around it — like an iris flower, a blue-violet gradient, distinctive, centered on the visual focus.

This isn't decoration. It's the core mechanism for human-agent collaboration:

- The user knows exactly what the agent is touching
- Agent actions and user actions are distinguishable in the audit trail
- High-risk or conflicting states can be paused in time
- Every write operation maps to a revertable commit

Iris doesn't try to let the agent silently take over an application. It makes the agent's actions visible, understandable, and reversible in the UI.

---

## ⭐ Star History

<a href="https://star-history.com/#yubai314/Iris&Date">
 <picture>
  <source media="(prefers-color-scheme: dark)"
    srcset="https://api.star-history.com/svg?repos=yubai314/Iris&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)"
    srcset="https://api.star-history.com/svg?repos=yubai314/Iris&type=Date" />
  <img alt="Star History Chart"
    src="https://api.star-history.com/svg?repos=yubai314/Iris&type=Date" />
 </picture>
</a>

---

## 🤝 Contributors

<a href="https://github.com/yubai314/Iris/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yubai314/Iris" />
</a>
