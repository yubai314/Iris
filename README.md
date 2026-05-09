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

Most approaches to LLM-driven desktop control are fundamentally teaching a model to read pictures — take a screenshot, spend multimodal tokens on pixels, guess where the button is, simulate a mouse click, then take another screenshot to confirm. The loop works, but it is slow and expensive when the app already knows exactly which command the user meant.

Iris gives developers a different choice.

Every user action in a modern desktop app ultimately isn't "a pixel was clicked" — it triggers a structured call that travels through an IPC channel and lands on a backend handler. That call has types, parameters, and semantics. It was always there.

Iris has one core claim:

> **An agent should follow the same path a user follows, but under the GUI: the app's own events, IPC commands, and backend handlers.**

It doesn't ask the model to keep rereading pixels. It doesn't guess coordinates. It doesn't bypass business logic. It helps developers — with minimal changes — bring their app to the state of something like the Obsidian CLI: full agent control built in, no external interfaces exposed, no external ecosystem required. Developers can restrict access to their own built-in agent only, keeping it entirely private.

The first version targets Tauri 2 as the reference implementation, with Electron to follow. TypeScript-first, with platform differences isolated behind adapters.

---

## Three Layers of Computer Use

We divide LLM-driven software control into three layers.

### Layer 0: External Visual Control

```
screenshot → vision model → coordinates → mouse simulation → screenshot to confirm
```

The advantage is near-zero integration cost. The disadvantages are clear: every step burns screenshot tokens and waits for visual inference; bulk operations (reorganizing 50 cards, for example) take minutes; the agent can only see what's in the viewport; operation semantics come from model guesses, not application declarations; there's no structured rollback for mistakes.

This path is a powerful hack, and it will remain useful for general desktop control and as a fallback. But it is not a long-term primary interface for high-reliability in-app agents.

Claude-style computer use is the clearest example of the screenshot loop: the agent sees a virtual screen and drives mouse and keyboard actions. There is already a better intermediate surface for web apps: the DOM and accessibility tree. Browser-oriented agents, including Codex-style page workflows, can attach work to structure, roles, labels, selectors, and element bounds instead of relying only on pixels.

That is a real step forward, especially for pages that expose good semantics. But an accessibility tree is still outside the app's business contract. It can tell an agent that a button exists; it cannot declare that `move_item` is reversible, version-checked, rate-limited, and recorded as an agent commit.

### Layer 1: In-App Semantic Control (Where Iris Lives)

```
user clicks button → frontend event → IPC command → backend business logic
agent action       → Iris executor  → same IPC command → same backend business logic
```

The agent travels the real business path — no bypassing validation, no guessing coordinates. Operation parameters are structured. Readable state and writable operations are declared by the app. Every write generates a commit. User and agent operations are distinguishable in the audit trail. A UI redesign doesn't affect command semantics.

This is where most production GUI agents are likely to land over the next one to three years: not pixel puppetry, and not unrestricted database access, but an app-owned semantic path below the interface.

Layer 1's security doesn't rely on policy — it relies on architecture. The agent can only call explicitly exposed commands, which are inherently a subset of what a user can do.

### Layer 2: Direct Data Layer Access

The agent calls the database, internal services, or a cloud REST API directly. Parts of the future will move in this direction: it is the most efficient path when the app, data model, permissions, and audit story are all designed for it. Today, for most GUI products, it is still too early and too dangerous as the default path. The agent may bypass the validation, permissions, and audit semantics of both the UI and business layers.

The more subtle risk is identity attribution. Feishu and DingTalk show strong product sense here: they understand that agents need to act where people already work. Obsidian is still the cleanest reference point for app-owned control: a local command surface that makes automation feel native without pretending the app has become an external API platform.

The legal and audit question starts when an agent executes with a user's OAuth token (`--as user`) and the log records the human as the actor, even though the decision came from a model. Iris keeps that boundary explicit by design: the agent operates through a dedicated channel, its identity is "agent", and user operations remain separate from agent operations in the commit history.

Iris's position: the primary agent path for frontend-backend GUI apps should be Layer 1. Layer 0 can serve as a fallback; Layer 2 can serve as a privileged capability — but neither should replace in-app semantic control.

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

Less pixel noise, more app structure.

### 3. Iris, the Violet Highlight

When an agent is manipulating a UI component, a colored highlight ring appears around it — like an iris flower, a blue-violet gradient, distinctive, centered on the visual focus.

The ring is there for a practical reason:

- The user knows exactly what the agent is touching
- Agent actions and user actions are distinguishable in the audit trail
- High-risk or conflicting states can be paused in time
- Every write operation maps to a revertable commit

Iris doesn't try to let the agent silently take over an application. It makes the agent's actions visible, understandable, and reversible in the UI.

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
import { iris } from "./iris";

export function Root() {
  return (
    <IrisProvider app={iris}>
      <App />
    </IrisProvider>
  );
}
```

`IrisProvider` handles render-tree snapshot traversal, the iris highlight overlay, commit history UI, and user confirmation dialogs.

---

## Known Engineering Challenges

These problems shouldn't be hidden — they should be addressed directly in the SDK design.

1. **No transparent interception:** The first version does not automatically discover and intercept all IPC. Explicit declaration is safer than transparent interception and makes boundaries easier to explain.

2. **Rollback is not a universal promise:** Sending a message, making a payment, and hard-deleting remote data cannot be strictly undone. Operations that can be undone record an undo. Operations that can be compensated record a restore payload. Operations that can't be undone must require confirmation. If a developer doesn't declare an undo, Iris doesn't pretend it's safe.

3. **Prompt injection can enter the agent through UI content:** Rendered text and business state are untrusted input. Iris's security does not rely on prompts — it relies on the manifest, policy, schema, confirm rules, and executor.

4. **TypeScript declarations and the backend may drift:** TypeScript declarations are a contract. In dev mode, Iris should run a schema probe; DevTools will flag schema mismatches; CI provides `iris check`.

5. **Manifests can get too large:** Layered capability support (core / contextual / discoverable / hidden) avoids the problem of MCP tool descriptions becoming overly verbose.

6. **Component IDs must be stable:** Elements without stable IDs can be read, but should not serve as anchors for writable operations. Use `data-iris-id` annotations.

7. **Protocol versioning from day one:** Manifests and commits include `irisProtocolVersion`, `appSchemaVersion`, and `commandVersion` to prevent history records from becoming invalid when commands are renamed or parameters change.

---

## Relationship to Existing Tools

Iris is a kit and SDK for in-app semantic control. It is closer in spirit to AG-UI than to a raw automation script: developers add a small runtime, declare a protocol surface, and let agents work through the application instead of around it.

AG-UI is about the event stream between an agent and a user-facing Web application. Iris is about the command path inside frontend-backend desktop applications. It can use a similar developer experience — protocol, runtime, UI hooks — but the target is different: existing Tauri, Electron, and WebView apps whose business logic already lives behind IPC commands.

Iris is also not competing with MCP. MCP is excellent for exposing tools, resources, and context to agents outside the application boundary. Those tools can be read-only or writable, depending on what the server exposes. Iris focuses on a narrower question: when an agent writes to a GUI app, how does that write go through the same validation, permissions, conflict checks, and audit trail as a user action?

In practice, MCP can be the read and discovery surface, while Iris provides the app-native write contract. MCP tells an agent what capabilities exist across a workspace; Iris makes sure a state-changing operation inside one app is declared, policy-checked, visible, and revertable when possible.

---

## Demo

**Tianji**, a Tauri 2-based desktop news reading app. Three-column kanban: Unread, Read Later, Archived.

Core validation task: the user says "move all tech cards to Read Later." Iris executes in the background in bulk, the iris highlight ring marks each card being manipulated, and when complete the user can view the commit history and revert any operation in one click.

The same task with Layer 0 Computer Use takes minutes. With Iris, it takes seconds. This comparison is one of the core quantitative metrics of the paper.

---

## 🤝 Contributors

<a href="https://github.com/yubai314/Iris/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yubai314/Iris" />
</a>

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
