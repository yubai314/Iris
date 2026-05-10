<div align="center">
<img src="assets/banner.png" alt="Iris" width="660" />

<h1>Iris</h1>

<p><strong>in-app runtime interface for semantic control</strong> · a GUI-to-agent command translator</p>

<!-- Tech Stack -->
<p>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white" alt="Zod" />
<img src="https://img.shields.io/badge/MCP-Protocol-0D9488?style=flat-square" alt="MCP Protocol" />
<img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
<img src="https://img.shields.io/badge/Tauri-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri" />
<img src="https://img.shields.io/badge/Server-Web%20SaaS-64748B?style=flat-square" alt="Server / Web SaaS" />
</p>

<!-- Positioning -->
<p>
<img src="https://img.shields.io/badge/Layer%201-In--App%20Semantic%20Control-7C3AED?style=flat-square" alt="Layer 1 In-App Semantic Control" />
<img src="https://img.shields.io/badge/Architecture-Kit%20%2B%20Runtime-8B5CF6?style=flat-square" alt="Kit + Runtime" />
<img src="https://img.shields.io/badge/MCP%20Server-Embedded-6366F1?style=flat-square" alt="MCP Server Embedded" />
<img src="https://img.shields.io/badge/Packages-10-A78BFA?style=flat-square" alt="10 Packages" />
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

Most approaches to LLM-driven desktop control are fundamentally teaching a model to read pictures — take a screenshot, spend multimodal tokens on pixels, guess where the button is, simulate a mouse click, then take another screenshot to confirm. The loop works, but it is slow and expensive when the application already knows exactly which command the user meant.

Iris gives developers a different choice.

Every user action in a modern GUI application ultimately isn't "a pixel was clicked" — it triggers a structured call that travels through IPC or an API handler and lands on business logic. That call has types, parameters, and semantics. It was always there.

Iris has one job: **translate that structure into something agents can call.**

> **Iris is a GUI-to-CLI translator. Your application's operations become agent-callable commands. The agent provides the judgment. Iris provides the path.**

Agents call Iris. Iris does not drive agents. The intelligence stays with the model; the semantic interface belongs to the application.

> **Planned — Assisted Declaration:** connect Iris to your running app and operate it normally for a few minutes. Iris watches your IPC calls and drafts the action declarations automatically — command names, argument shapes, inferred risk levels. You review the draft, confirm what can be undone, add highlight rules, and ship. The semantic surface writes itself.

---

## Three Layers of Computer Use

We divide LLM-driven software control into three layers.

### Layer 0: External Visual Control

```
screenshot → vision model → coordinates → mouse simulation → screenshot to confirm
```

Near-zero integration cost. Every step burns screenshot tokens and waits for visual inference; bulk operations take minutes; the agent can only see what's in the viewport; operation semantics come from model guesses, not application declarations; there's no structured rollback.

This path remains useful for general desktop control and as a fallback. But it is not a long-term primary interface for high-reliability in-app agents.

### Layer 1: In-App Semantic Control (Where Iris Lives)

```
user clicks button  →  frontend event  →  IPC / API call  →  backend business logic
agent action        →  Iris command    →  same IPC / API  →  same backend business logic
```

The agent travels the real business path — no bypassing validation, no guessing coordinates. Operation parameters are structured. Readable state and writable operations are declared by the application. Every write generates a commit. User and agent operations are distinguishable in the audit trail. A UI redesign doesn't affect command semantics.

Layer 1's security doesn't rely on policy — it relies on architecture. The agent can only call explicitly exposed commands, which are inherently a subset of what a user can do.

### Layer 2: Direct Data Layer Access

The agent calls the database or internal services directly. Efficient when the data model, permissions, and audit story are all designed for it. Today, for most GUI products, it bypasses the validation, permissions, and audit semantics of both the UI and business layers.

Iris's position: the primary agent path for GUI applications should be Layer 1. Layer 0 can serve as a fallback; Layer 2 as a privileged capability — but neither replaces in-app semantic control.

---

## How Iris Works

### What Only Iris Provides

Every MCP server exposes tools. What distinguishes Iris is the semantic safety layer attached to every one of them:

**scope · UI anchor · highlight · confirm · commit · undo · actor · risk · resource version**

These nine properties travel with every operation. An agent cannot call a command outside its declared scope, cannot skip confirmation on a high-risk write, cannot execute a write without generating a commit, and cannot act without its identity recorded as `actor`. A UI redesign cannot break the command surface. A resource version conflict surfaces before execution, not after.

No generic MCP server generator provides this. No openapi-to-mcp tool provides this. This is the moat.

### The Architecture

```
Claude Code / Codex / any MCP-compatible agent
                  │
                  │  MCP protocol
                  ▼
          @iris/mcp server          ← embedded in your app, co-located
                  │
                  │  scoped to what the user chose to expose
                  ▼
           @iris/core               ← schema validation, policy, commit, revert
                  │
                  ▼
      Platform adapter              ← @iris/electron  |  @iris/server  |  @iris/tauri
                  │
                  ▼
   Your app's business logic        ← the same handlers your UI calls
```

Iris does not live between the user and the agent. It lives between the agent and your application's real API surface. The agent calls Iris; Iris calls your backend through the same path a real user action would take.

### The Two-Layer World Model

The agent sees your application through two complementary lenses.

```
Layer 1 — DOM Snapshot (spatial context)
  Where things are on screen.
  Every element annotated with data-iris-id exposes:
    { id, text, role, bounds: { x, y, width, height } }
  Answers: "What is visible, and where?"

Layer 2 — Readable Commands (semantic context)
  What things actually contain.
  Your declared readable commands return full backend data:
    { id, title, fullContent, source, tags, publishedAt, ... }
  Not limited by truncation or viewport.
  Answers: "What does this item mean, what does it contain?"
```

The agent classifies, reasons, and decides based on Layer 2. Layer 1 provides spatial context for operations that need positional awareness. The richer your readable commands, the better the agent's judgment — and this is always richer than anything a screenshot can offer.

### Granular Scope Control

The user decides — at runtime, per element — what the agent can see and touch.

```
Whiteboard            [iris ●]  →  agent can see this board
  ├── Group A         [iris ●]  →  agent can read and write here
  ├── Group B         [iris ●]  →  agent can read and write here
  ├── Group C         [iris ○]  →  invisible to the agent
  └── Private notes   [iris ○]  →  invisible to the agent
            │
            ├── card-001  [iris ●]  →  single card exposed individually
            └── card-002  [iris ○]  →  hidden from agent
```

The developer annotates what *can* be exposed. The user decides what *is* exposed, at the moment they hand control to an agent. Enabling an element is the declaration — no static configuration required for dynamic, user-created content.

When the user clicks the iris button, a scoped session token is generated containing exactly the enabled elements. The agent connects with that token; all data is filtered to the enabled scope. Disabled elements are not redacted or empty — they are simply not present.

---

## The Name

Iris has three layers of meaning, from outside in.

### 1. Iris, Messenger Goddess

In Greek mythology, Iris was the only messenger who could travel freely between the gods and mortals. She didn't create intent or make decisions — she was simply the reliable path connecting two worlds.

This is exactly the role Iris plays: it stands between the agent runtime and the application, translating natural language tasks into semantic operations that genuinely exist inside the application, and feeding structured state back to the agent. It doesn't make decisions for the agent. It is a faithful channel.

### 2. Iris, the Pupil

The iris is the structure in the eye that regulates light. It doesn't decide what you see, but it decides how you see — with what precision, what boundaries, what contrast.

For an agent, Iris plays the same role as a perceptual boundary. Traditional computer use relies on screenshots; the agent sees flattened pixels with no structure, no semantics, no hierarchy. Iris lets the agent see a model closer to the application's true world:

- Visible text, component IDs, and semantic annotations from the render tree
- Structured business state returned by readable commands
- A filtered domain event stream with all UI noise removed

Less pixel noise, more application structure.

### 3. Iris, the Violet Highlight

When an agent is operating on a UI element, a violet highlight ring appears around it — like an iris flower, a blue-violet gradient, centered on the agent's current focus.

The ring is there for a practical reason:

- The user knows exactly what the agent is touching
- Agent actions and user actions are distinguishable in the audit trail
- High-risk operations pause for user confirmation
- Every write maps to a revertable commit

Iris doesn't let the agent silently take over an application. It makes the agent's actions visible, understandable, and reversible.

---

## Scope

Iris targets frontend-backend GUI applications — products where the UI runs in a web renderer and business logic lives behind an IPC boundary or an API layer.

```
Frontend    Web UI / DOM / React / Vue / Svelte, etc.
Backend     Business logic served via IPC handlers or service functions
Runtime     Electron, Tauri, or any web SaaS backend
Language    TypeScript-first
```

First-phase adapter order:

```
1. Electron    Reference implementation
2. Tauri       Follow-up adapter
3. Web SaaS    Server-side adapter
```

Flutter, Qt, and native macOS/Windows require reworking the render tree and accessibility tree and are out of scope for the first phase.

---

## What's in Iris

<a id="whats-in-the-iris-kit"></a>

Iris is composed of two parts with distinct roles.

### Iris Kit — Developer Tooling

What developers use to set up Iris. Not shipped to end users.

**Standard Operation Library `@iris/std`**

Pre-built semantic operations with correct safety properties declared out of the box. Developers check off what their application supports:

```
✅ item.archive       → schema, undo, and risk level: all pre-declared
✅ item.flag          → schema, undo, and risk level: all pre-declared
✅ collection.add     → schema, undo, and risk level: all pre-declared
✅ batch.move         → schema, undo, and risk level: all pre-declared
□  item.delete        → developer declares confirm policy explicitly
□  custom.myOp        → fully custom declaration
```

**Declaration UI**

A developer-facing interface for declaring operations, reviewing the generated manifest, and managing policy — designed for developers who prefer configuration over code. Planned: an agent mode that scans your codebase and suggests declarations automatically.

**Test Harness `@iris/test-utils`**

Simulate agent calls locally without connecting a real agent. Verify that declared operations execute correctly, that commits are generated, that policy is enforced, and that undo works — before opening Claude Code.

### Iris Runtime — Embedded in Your App

What runs in production, embedded in every application that uses Iris.

**`@iris/core`** — The execution engine. Command registry, schema validation, policy enforcement, commit generation, revert. The single entry point all agent actions flow through.

**`@iris/mcp`** — The MCP server. Translates Iris commands into MCP tools that any compatible agent can discover and call. Runs co-located with your application; no separate Iris cloud service.

**`@iris/[platform]`** — Platform adapters bridge `@iris/core` to your application's actual backend.
- `@iris/electron` — Electron's `ipcMain` / `ipcRenderer`
- `@iris/server` — direct service function calls for web SaaS backends
- `@iris/tauri` — Tauri 2's `invoke`

**`@iris/react`** — The visual layer. The iris button (scope selection and token generation), the violet ring overlay, confirmation dialogs, and the commit history UI.

**`@iris/devtools`** — Debug panel: live manifest, commit log, domain events, active policy. Development mode only.

### Package Summary

```
@iris/protocol      Protocol types shared across all packages
@iris/core          Execution engine — command registry, policy, commit, revert
@iris/std           Standard semantic operation library
@iris/electron      Electron platform adapter
@iris/server        Web SaaS platform adapter
@iris/tauri         Tauri platform adapter
@iris/react         UI layer — iris button, ring overlay, commit history
@iris/mcp           MCP server — the agent entry point
@iris/test-utils    Local harness for testing without a real agent
@iris/devtools      Debug panel
```

---

## Core Concepts

### Command Registry

Commands fall into two categories:

```
readable    Read-only. No side effects. Used to build the world model.
writable    Write operations. Every execution generates a commit.
```

Read-only command:

```ts
import { defineIrisApp, readable, z } from "@iris/core";
import { electronAdapter } from "@iris/electron";

export const iris = defineIrisApp({
  platform: "electron",
  adapter: electronAdapter(),
  commands: {
    getFeedItems: readable({
      invoke: "get_feed_items",
      description: "Get all items in the current feed scope",
      args: z.object({ groupId: z.string().optional() }),
      returns: z.array(FeedItemSchema),
    }),
  },
});
```

Write commands answer three questions: what resource is being changed, how risky is it, and how can it be undone.

```ts
moveItem: writable({
  invoke: "move_item",
  description: "Move an item to the specified group",
  resource: "item",
  risk: "reversible",
  revertable: true,
  args: z.object({
    id: z.string(),
    targetGroupId: z.string(),
  }),
  undo: inverse("move_item"),
}),
```

Irreversible operations require explicit declaration and user confirmation by default:

```ts
deleteGroup: writable({
  invoke: "delete_group",
  description: "Permanently delete a group and all its items",
  resource: "group",
  risk: "irreversible",
  revertable: false,
  confirm: "required",
  args: z.object({ id: z.string() }),
}),
```

**`revertable` defaults to `false`** — developers must explicitly declare that an operation is reversible before Iris records an undo policy. This is the conservative principle: require confirmation rather than make promises that can't be kept.

### The Two-Layer World Model

`getWorld()` returns both layers to the agent before it acts:

```ts
// What the agent receives
{
  manifest: { ... },         // declared operations and their schemas
  readable: {                // full backend data from readable commands
    getFeedItems: [
      {
        id: "card-391",
        title: "Iran closes Strait of Hormuz",
        fullContent: "...",  // not truncated by UI
        source: "Reuters",
        tags: ["Iran", "energy", "Middle East"],
        publishedAt: "2025-05-09T10:30:00Z"
      }
    ],
    getGroups: [
      { id: "col-1", name: "European Impact", cardCount: 12 },
      { id: "col-2", name: "China Response",  cardCount: 8  }
    ]
  },
  snapshot: { ... }          // DOM snapshot for spatial context
}
```

The agent classifies and decides based on `readable`. It uses `snapshot` when spatial position matters. It never reads truncated UI text to make semantic decisions — and this is always more information than any screenshot can provide.

### Scope Control

The iris button is the user's permission interface. Clicking it on any annotated element — a board, a group, or an individual card — enables that element for agent access.

```tsx
// Developer annotates elements
<NewsCard data-iris-id={`card-${item.id}`}>...</NewsCard>
<GroupColumn data-iris-id={`col-${col.id}`}>...</GroupColumn>
```

When the user enables a scope and connects, Iris generates a session token encoding the active scope. The MCP server filters all manifests, readable results, and writable targets to that scope. An agent operating on Group A cannot touch Group B — not by policy, but by architecture.

### Highlight System

When the agent executes a command, Iris automatically highlights the affected elements. For most commands, the mapping is inferred from argument names matching `data-iris-id` conventions:

```
agent calls: moveItem({ id: "card-391", targetGroupId: "col-1" })

Iris infers:
  data-iris-id="card-391"  →  source ring (violet, solid)
  data-iris-id="col-1"     →  target ring (violet, dashed)
```

For complex operations, developers declare the mapping explicitly:

```ts
batchClassify: writable({
  // ...
  highlight: ({ args }) => [
    ...args.itemIds.map(id => ({ id: `card-${id}`, phase: "source" })),
    { id: `col-${args.targetGroupId}`, phase: "target" },
  ],
}),
```

The user sees the ring appear before execution (intent), pulse during execution (active), and resolve when the commit is recorded (done). Three phases, always visible.

For long-running batch operations, Iris emits progress events that the ring reflects — pulsing with each completed step, settling when the batch finishes:

```ts
// emitted by @iris/core as each step completes
{ type: "progress", command: "batchMove", completed: 12, total: 50 }
```

No separate loading state or spinner needed. The ring is the progress indicator.

### Commit History

Every writable operation produces a commit:

```json
{
  "commitId": "commit_003",
  "command": "move_item",
  "args": { "id": "card-391", "targetGroupId": "col-1" },
  "before": { "groupId": "feed" },
  "after":  { "groupId": "col-1" },
  "revertable": true,
  "inverse": { "command": "move_item", "args": { "id": "card-391", "targetGroupId": "feed" } },
  "actor": "agent",
  "timestamp": "2025-05-09T11:00:00Z",
  "status": "active"
}
```

Users can revert by individual commit or revert an entire agent session in one click. The `actor` field distinguishes user operations from agent operations in the history.

### Error Codes

| Code | Meaning |
|---|---|
| `PERMISSION_DENIED` | Command not in allowlist or banned by policy |
| `STATE_CONFLICT` | Resource version mismatch — concurrent user change detected |
| `SCHEMA_INVALID` | Arguments don't match the declared schema |
| `USER_CONFIRM_REQUIRED` | High-risk operation awaiting user confirmation |
| `APP_BUSY` | Application is not safe to execute at this moment |
| `REDACTED_FIELD` | Attempted access to an agent-blind area |
| `RATE_LIMITED` | Write operation throttled by policy |
| `UNSUPPORTED_COMMAND` | Command not declared or not available in current scope |
| `MODEL_OUTPUT_INVALID` | Agent response did not match the expected format |

---

## Electron Integration

<a id="tauri-integration-first-version"></a>

Augur — the reference application — is an Electron app. The Iris runtime runs in the main process; the React layer runs in the renderer; the MCP server exposes a local endpoint that Claude Code connects to via its MCP configuration.

```ts
// Main process — iris.ts
import { defineIrisApp, readable, writable, inverse, z } from "@iris/core";
import { electronAdapter } from "@iris/electron";

export const iris = defineIrisApp({
  platform: "electron",
  adapter: electronAdapter(),
  commands: {
    getFeedItems: readable({
      invoke: "get_feed_items",
      description: "Get all items currently in scope",
      args: z.object({}),
      returns: z.array(FeedItemSchema),
    }),
    getGroups: readable({
      invoke: "get_groups",
      description: "Get all iris-enabled groups",
      args: z.object({}),
      returns: z.array(GroupSchema),
    }),
    moveItem: writable({
      invoke: "move_item",
      description: "Move an item to the specified group",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ id: z.string(), targetGroupId: z.string() }),
      undo: inverse("move_item"),
    }),
    createGroup: writable({
      invoke: "create_group",
      description: "Create a new group on the workspace",
      resource: "group",
      risk: "reversible",
      revertable: true,
      args: z.object({ name: z.string() }),
    }),
  },
});
```

```tsx
// Renderer — root.tsx
import { IrisProvider } from "@iris/react";
import { iris } from "../main/iris";

export function Root() {
  return (
    <IrisProvider app={iris}>
      <App />
    </IrisProvider>
  );
}
```

`IrisProvider` handles the iris button, the ring overlay, confirmation dialogs, and the commit history panel. The MCP server starts alongside the app. Claude Code connects via the generated session endpoint with the user's scope token.

---

## Known Engineering Challenges

These problems shouldn't be hidden — they should be addressed directly in the design.

1. **Agents are not daemons.** Claude Code and similar tools are designed for task-scoped sessions, not continuous background monitoring. Design for one-shot or batch operations triggered by the user — not for long-running autonomous loops. The right question is not "can Iris monitor my feed forever?" but "can the user hand Iris a batch of fifty cards and get them classified in ten seconds?"

2. **Scope sync between renderer and MCP server.** The user enables elements in the browser or renderer; the MCP server must reflect that scope when an agent connects. For Electron, IPC handles this natively. For web SaaS, the scope must be persisted and looked up via session token.

3. **Rollback is not a universal promise.** Sending a message, making a payment, hard-deleting remote data — these cannot be strictly undone. Operations that can be undone record an undo. Operations that can be compensated record a restore payload. Operations that can't be undone must require confirmation. If a developer doesn't declare an undo, Iris doesn't pretend it's safe.

4. **TypeScript declarations and the backend may drift.** Declarations are a contract. In dev mode, Iris runs a schema probe; DevTools flags mismatches; CI provides `iris check`.

5. **Prompt injection enters through content.** Rendered text and business state are untrusted input. Iris's security does not rely on prompts — it relies on the manifest, policy, schema, confirm rules, and executor. An adversarially crafted article headline cannot invoke a command.

6. **Manifests can get too large.** Layered capability support (core / contextual / discoverable / hidden) avoids sending the agent the entire operation surface at once.

7. **Protocol versioning from day one.** Manifests and commits include `irisProtocolVersion`, `appSchemaVersion`, and `commandVersion` to prevent records from becoming invalid when commands are renamed or parameters change.

---

## Relationship to Existing Tools

**MCP** is the transport Iris speaks, not the product Iris is. MCP defines how tools are described and called across a boundary; Iris defines what those tools mean — their risk level, reversibility, confirmation requirements, and audit trail. There are already tools that generate MCP servers from OpenAPI specs. What they don't provide is the semantic safety layer: a commit for every write, a revert path for every commit, a visible ring for every agent action, and a scope boundary controlled by the user at runtime.

In practice, MCP serves well as the discovery surface for capabilities across a workspace. Iris makes sure a state-changing operation inside a specific application is declared, policy-checked, visible, and revertable when the developer says it can be.

**AG-UI** addresses the event stream between an agent and a user-facing web application — how the agent's output flows to the UI in real time. Iris and AG-UI are complementary: AG-UI handles the communication layer, Iris handles the control layer. They are not in competition. The violet ring and commit stream in Iris are a visual communication layer in the same spirit as AG-UI; the plan is to align Iris's event protocol with AG-UI's event definitions where they overlap, so developers using both do not face two incompatible event shapes.

**WebMCP / MCP-B** extends MCP to browser-native environments without requiring a local stdio process. Iris plans to export its MCP surface in WebMCP-compatible form so that Iris-enabled web SaaS applications can be reached by agents running entirely in the browser — no companion server required. This is planned but not yet implemented; `@iris/mcp` is designed with this extension in mind.

**Computer Use and browser agents** operate at Layer 0 or through the accessibility tree. They can read structure and roles; they cannot declare that `move_item` is reversible, version-checked, rate-limited, and recorded as an agent commit. Iris is the step past the accessibility tree for applications that want to own their agent surface.

---

## Demo

**Augur** is an Electron-based news reader built as the reference implementation for Iris. The left panel shows live RSS feeds as cards; the center is a workspace of user-defined kanban groups.

**Core validation task:** fifty articles related to the Iran conflict have accumulated in the feed. The user enables the feed and three target groups — *European Impact*, *China Response*, *Trump / TACO* — with the iris button, then tells Claude Code: *classify the Iran-related articles into the three groups; create a new group for anything that doesn't fit*.

What happens:

1. Claude Code connects to the Augur MCP server with the scoped session token.
2. Claude Code calls `getFeedItems()` — receives full article content, not truncated card text.
3. Claude Code calls `getGroups()` — receives the user-defined group names exactly as typed.
4. For each article, Claude Code calls `moveItem()`. Iris highlights the source card and target group with the violet ring before and during execution.
5. One article — *Iran launches ballistic missiles toward Israel* — fits none of the existing groups. Claude Code calls `createGroup({ name: "Escalation" })`, then `moveItem()` into it.
6. Fifty-one commits are recorded. The user reviews the history, finds three misclassified cards, and reverts them in one click. The session is done.

The same task with Layer 0 Computer Use: screenshot, read truncated card title, click target, screenshot to confirm, repeat — one card at a time. With Iris: full content retrieved in a single readable call, fifty moves executed in seconds, complete audit trail, reversible.

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
