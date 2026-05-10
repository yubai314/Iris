import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { IrisApp } from "@iris/core";
import type { IrisAction } from "@iris/protocol";

export interface IrisMcpServerOptions {
  app: IrisApp;
  name?: string;
  version?: string;
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
): Promise<IrisToolCallResult> {
  const text = (value: unknown): IrisToolCallResult => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  });
  const errorResult = (value: unknown): IrisToolCallResult => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    isError: true,
  });

  if (name === IRIS_WORLD) {
    return text(await app.getWorld());
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

  constructor(options: IrisMcpServerOptions) {
    this.app = options.app;
    this.server = new Server(
      { name: options.name ?? "iris", version: options.version ?? "0.1.0" },
      { capabilities: { tools: {} } },
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: buildToolList(this.app),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: rawArgs = {} } = request.params;
      return callTool(this.app, name, rawArgs as Record<string, unknown>);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
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
