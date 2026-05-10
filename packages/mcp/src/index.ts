import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { IrisApp } from "@iris/core";
import type { IrisAction, IrisScopeToken } from "@iris/protocol";

export interface IrisMcpServerOptions {
  app: IrisApp;
  name?: string;
  version?: string;
  /**
   * Return the current scope token to restrict what the agent can see and touch.
   * Called on every iris_world request and before every writable execution.
   * If null, the agent operates without scope restrictions (useful during development).
   */
  getScopeToken?: () => IrisScopeToken | null;
  /**
   * Return a fresh DOM snapshot to include in iris_world. Wire this to an IPC
   * call from main → renderer (e.g. `ipcMain.handle` that calls collectIrisSnapshot).
   * If omitted, snapshot is null in the world response.
   */
  getSnapshot?: () => unknown | Promise<unknown>;
}

export interface IrisToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const IRIS_WORLD = "iris_world";
const IRIS_COMMITS = "iris_commits";
const IRIS_REVERT = "iris_revert";

export function buildToolList(app: IrisApp): Tool[] {
  const manifest = app.getManifest();

  const builtins: Tool[] = [
    {
      name: IRIS_WORLD,
      description:
        "Get the current world state: manifest, all readable data, and DOM snapshot. Call this first before taking any action.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: IRIS_COMMITS,
      description: "Get the commit history of all agent and user actions in this session.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: IRIS_REVERT,
      description: "Revert a previously executed commit by its commitId.",
      inputSchema: {
        type: "object",
        properties: {
          commitId: { type: "string", description: "The commitId to revert" },
        },
        required: ["commitId"],
      },
    },
  ];

  const commandTools: Tool[] = manifest.commands.map((cmd) => {
    const baseSchema =
      (cmd.argsSchema as Record<string, unknown> | undefined) ??
      ({ type: "object", properties: {} } as Record<string, unknown>);

    const inputSchema =
      cmd.kind === "writable" ? injectConfirmField(baseSchema) : baseSchema;

    return {
      name: cmd.name,
      description: buildDescription(cmd),
      inputSchema: inputSchema as Tool["inputSchema"],
    };
  });

  return [...builtins, ...commandTools];
}

export async function callTool(
  app: IrisApp,
  name: string,
  args: Record<string, unknown>,
  scopeToken?: IrisScopeToken | null,
  getSnapshot?: () => unknown | Promise<unknown>,
): Promise<IrisToolCallResult> {
  const text = (value: unknown): IrisToolCallResult => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  });
  const errorResult = (value: unknown): IrisToolCallResult => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    isError: true,
  });

  if (name === IRIS_WORLD) {
    const world = await app.getWorld();
    const enabledIds = scopeToken ? new Set(scopeToken.enabledIds) : null;
    const readable = enabledIds ? filterReadableByScope(world.readable, enabledIds) : world.readable;
    const snapshot = getSnapshot ? await getSnapshot() : null;
    return text({ ...world, readable, scope: scopeToken ?? null, snapshot });
  }

  if (name === IRIS_COMMITS) {
    return text(app.getCommits());
  }

  if (name === IRIS_REVERT) {
    const commitId = args.commitId;
    if (typeof commitId !== "string") {
      return errorResult({ error: { code: "SCHEMA_INVALID", message: "commitId must be a string" } });
    }
    const result = await app.revertCommit(commitId);
    return result.ok ? text(result.value) : errorResult({ error: result.error });
  }

  const manifest = app.getManifest();
  const cmd = manifest.commands.find((c) => c.name === name);
  if (!cmd) {
    return errorResult({ error: { code: "UNSUPPORTED_COMMAND", message: `Unknown tool: ${name}` } });
  }

  const confirmed = args._confirmed === true;
  const cleanArgs = withoutConfirmField(args);

  if (scopeToken && scopeToken.enabledIds.length > 0 && cmd.kind === "writable") {
    const scopeDenied = checkScopeViolation(cleanArgs, cmd.scopeArgs ?? ["id", "ids"], new Set(scopeToken.enabledIds));
    if (scopeDenied) {
      return errorResult({ error: { code: "PERMISSION_DENIED", message: scopeDenied } });
    }
  }

  const action: IrisAction = { command: name, args: cleanArgs };
  const result = await app.execute(action, { actor: "agent", confirmed });

  if (!result.ok) {
    if (result.error.code === "USER_CONFIRM_REQUIRED") {
      return text({
        needsConfirm: true,
        message: `"${name}" requires confirmation. Re-call with _confirmed: true to proceed.`,
        command: name,
        args: cleanArgs,
      });
    }
    return errorResult({ error: result.error });
  }

  return text(result.value);
}

export function createIrisMcpServer(options: IrisMcpServerOptions): IrisMcpServer {
  return new IrisMcpServer(options);
}

export class IrisMcpServer {
  private readonly app: IrisApp;
  private readonly server: Server;
  private readonly getScopeToken: () => IrisScopeToken | null;
  private readonly getSnapshot: (() => unknown | Promise<unknown>) | undefined;

  constructor(options: IrisMcpServerOptions) {
    this.app = options.app;
    this.getScopeToken = options.getScopeToken ?? (() => null);
    this.getSnapshot = options.getSnapshot;
    this.server = new Server(
      { name: options.name ?? "iris", version: options.version ?? "0.1.0" },
      { capabilities: { tools: {} } },
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: buildToolList(this.app),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: rawArgs = {} } = request.params;
      return callTool(this.app, name, rawArgs as Record<string, unknown>, this.getScopeToken(), this.getSnapshot);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

function filterReadableByScope(
  readable: Record<string, unknown>,
  enabledIds: Set<string>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(readable)) {
    if (Array.isArray(value)) {
      filtered[key] = value.filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          enabledIds.has(String((item as Record<string, unknown>).id)),
      );
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}

function checkScopeViolation(
  args: Record<string, unknown>,
  scopeArgNames: string[],
  enabledIds: Set<string>,
): string | null {
  for (const argName of scopeArgNames) {
    const val = args[argName];
    if (typeof val === "string" && !enabledIds.has(val)) {
      return `"${argName}" value "${val}" is not in scope`;
    }
    if (Array.isArray(val)) {
      const out = val.filter((v) => typeof v === "string" && !enabledIds.has(v));
      if (out.length > 0) return `"${argName}" contains ids not in scope: ${out.join(", ")}`;
    }
  }
  return null;
}

function buildDescription(
  cmd: ReturnType<IrisApp["getManifest"]>["commands"][number],
): string {
  const parts: string[] = [];
  if (cmd.description) parts.push(cmd.description);
  if (cmd.kind === "writable") {
    if (cmd.risk) parts.push(`Risk: ${cmd.risk}.`);
    if (cmd.revertable) parts.push("Revertable.");
    if (cmd.confirm === "required") parts.push("Requires confirmation — pass _confirmed: true.");
  }
  return parts.join(" ") || cmd.name;
}

function injectConfirmField(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = (schema.properties as Record<string, unknown> | undefined) ?? {};
  return {
    ...schema,
    properties: {
      ...properties,
      _confirmed: {
        type: "boolean",
        description: "Pass true to confirm execution of commands that require confirmation.",
      },
    },
  };
}

function withoutConfirmField(args: Record<string, unknown>): Record<string, unknown> {
  const { _confirmed: _, ...rest } = args;
  return rest;
}
