import {
  type IrisAction,
  type IrisActor,
  type IrisCommandLayer,
  type IrisCommit,
  type IrisErrorCode,
  type IrisConfirm,
  type IrisEvent,
  type IrisManifest,
  type IrisManifestCommand,
  type IrisPlatform,
  type IrisPlatformAdapter,
  type IrisPolicy,
  type IrisRedactionRule,
  type IrisResult,
  type IrisRisk,
  type IrisWorld,
} from "@iris/protocol";
import { z, type ZodType } from "zod";

export { z };
export type {
  IrisAction,
  IrisActor,
  IrisCommit,
  IrisEvent,
  IrisManifest,
  IrisPlatform,
  IrisPlatformAdapter,
  IrisPolicy,
  IrisResult,
  IrisWorld,
} from "@iris/protocol";

export interface CommandCaptureContext<TArgs> {
  args: TArgs;
  adapter: IrisPlatformAdapter;
}

export interface UndoContext<TArgs> {
  args: TArgs;
  before: unknown;
  after: unknown;
  commit: IrisCommit;
}

export interface ReadableCommandConfig<TArgs = unknown, TReturn = unknown> {
  invoke: string;
  layer?: IrisCommandLayer;
  description?: string;
  commandVersion?: string;
  args: ZodType<TArgs>;
  returns?: ZodType<TReturn>;
}

export interface WritableCommandConfig<TArgs = unknown> {
  invoke: string;
  layer?: IrisCommandLayer;
  description?: string;
  resource?: string;
  risk?: IrisRisk;
  commandVersion?: string;
  revertable?: boolean;
  confirm?: IrisConfirm;
  args: ZodType<TArgs>;
  captureBefore?: (context: CommandCaptureContext<TArgs>) => Promise<unknown>;
  captureAfter?: (context: CommandCaptureContext<TArgs>) => Promise<unknown>;
  getCurrentVersion?: (context: CommandCaptureContext<TArgs>) => Promise<unknown>;
  undo?: (context: UndoContext<TArgs>) => IrisAction;
}

interface InternalReadableCommand<TArgs = unknown, TReturn = unknown>
  extends ReadableCommandConfig<TArgs, TReturn> {
  kind: "readable";
}

interface InternalWritableCommand<TArgs = unknown>
  extends WritableCommandConfig<TArgs> {
  kind: "writable";
}

type InternalCommand = InternalReadableCommand<any, any> | InternalWritableCommand<any>;

export type IrisCommandRegistry = Record<string, InternalCommand>;

export interface DefineIrisAppOptions {
  platform: IrisPlatform;
  adapter: IrisPlatformAdapter;
  commands: IrisCommandRegistry;
  irisProtocolVersion?: string;
  appSchemaVersion?: string;
  /** Tauri/Electron event names to subscribe to as domainState events. */
  domainEvents?: string[];
}

export interface ExecuteOptions {
  actor?: IrisActor;
  idempotencyKey?: string;
  confirmed?: boolean;
  expectedVersion?: unknown;
}

export interface ExecuteValue {
  result: unknown;
  commit?: IrisCommit;
}

export function readable<TArgs = unknown, TReturn = unknown>(
  config: ReadableCommandConfig<TArgs, TReturn>,
): InternalReadableCommand<TArgs, TReturn> {
  return { ...config, kind: "readable" };
}

export function writable<TArgs = unknown>(
  config: WritableCommandConfig<TArgs>,
): InternalWritableCommand<TArgs> {
  return { ...config, kind: "writable", revertable: config.revertable ?? false };
}

export function inverse<TArgs = unknown>(command: string): (context: UndoContext<TArgs>) => IrisAction {
  return ({ args }) => ({ command, args: args as unknown });
}

export function defineIrisApp(options: DefineIrisAppOptions): IrisApp {
  return new IrisApp(options);
}

export class IrisApp {
  private readonly platform: IrisPlatform;
  private readonly adapter: IrisPlatformAdapter;
  private readonly commands: IrisCommandRegistry;
  private readonly irisProtocolVersion: string;
  private readonly appSchemaVersion?: string;
  private policy: IrisPolicy = {};
  private appBusy = false;
  private commits: IrisCommit[] = [];
  private eventLog: IrisEvent[] = [];
  private eventHandlers = new Set<(event: IrisEvent) => void>();
  private idempotencyCache = new Map<string, IrisResult<ExecuteValue>>();
  private rateLimitLog = new Map<string, number[]>();
  private commitSequence = 0;

  constructor(options: DefineIrisAppOptions) {
    this.platform = options.platform;
    this.adapter = options.adapter;
    this.commands = options.commands;
    this.irisProtocolVersion = options.irisProtocolVersion ?? "0.1.0";
    this.appSchemaVersion = options.appSchemaVersion;

    if (options.domainEvents && options.adapter.subscribe) {
      for (const eventName of options.domainEvents) {
        options.adapter.subscribe(eventName, (payload) => {
          this.emitEvent({
            name: eventName,
            kind: "domainState",
            payload,
            timestamp: new Date().toISOString(),
          });
        });
      }
    }
  }

  getManifest(): IrisManifest {
    return {
      irisProtocolVersion: this.irisProtocolVersion,
      appSchemaVersion: this.appSchemaVersion,
      platform: this.platform,
      commands: Object.entries(this.commands).map(([name, command]) =>
        this.toManifestCommand(name, command),
      ),
    };
  }

  async getWorld(): Promise<IrisWorld> {
    const readableState: Record<string, unknown> = {};

    for (const [name, command] of Object.entries(this.commands)) {
      if (command.kind !== "readable") continue;
      const parsed = command.args.safeParse({});
      if (!parsed.success) {
        readableState[name] = { error: "READABLE_ARGS_INVALID" };
        continue;
      }
      try {
        readableState[name] = await this.adapter.invoke(command.invoke, parsed.data);
      } catch (error) {
        readableState[name] = {
          error: "READABLE_FAILED",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      manifest: this.getManifest(),
      readable: this.applyRedactions(readableState),
    };
  }

  getCommits(): IrisCommit[] {
    return [...this.commits];
  }

  setPolicy(policy: IrisPolicy): void {
    this.policy = policy;
  }

  getPolicy(): IrisPolicy {
    return { ...this.policy };
  }

  setAppBusy(busy: boolean): void {
    this.appBusy = busy;
  }

  getEventLog(): IrisEvent[] {
    return [...this.eventLog];
  }

  subscribeToEvents(handler: (event: IrisEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  async execute(
    action: IrisAction,
    options: ExecuteOptions = {},
  ): Promise<IrisResult<ExecuteValue>> {
    const command = this.commands[action.command];
    if (!command) {
      return err("UNSUPPORTED_COMMAND", `Unknown iris command: ${action.command}`);
    }

    if (this.isBanned(action.command, command.invoke)) {
      return err("PERMISSION_DENIED", `Command is banned: ${action.command}`);
    }

    const parsed = command.args.safeParse(action.args ?? {});
    if (!parsed.success) {
      return err("SCHEMA_INVALID", "Action arguments do not match command schema", parsed.error);
    }

    if (this.appBusy) {
      return err("APP_BUSY", "App is marked busy");
    }

    if (command.kind === "readable") {
      try {
        const result = await this.adapter.invoke(command.invoke, parsed.data);
        return ok({ result });
      } catch (error) {
        return err("APP_BUSY", messageFrom(error));
      }
    }

    const hasExecutableUndo =
      command.revertable === true && typeof command.undo === "function";
    const requiresConfirmation =
      command.confirm === "required" ||
      this.requiresPolicyConfirmation(action.command, command.invoke) ||
      !hasExecutableUndo;

    if (requiresConfirmation && options.confirmed !== true) {
      return err("USER_CONFIRM_REQUIRED", `Command requires confirmation: ${action.command}`);
    }

    if (options.idempotencyKey && this.idempotencyCache.has(options.idempotencyKey)) {
      return this.idempotencyCache.get(options.idempotencyKey)!;
    }

    if (this.isRateLimited(action.command, command.invoke)) {
      return err("RATE_LIMITED", `Command is rate limited: ${action.command}`);
    }

    const versionResult = await this.checkExpectedVersion(
      command,
      parsed.data,
      options.expectedVersion,
    );
    if (!versionResult.ok) return versionResult;

    const beforeResult = await this.captureBefore(command, parsed.data);
    if (!beforeResult.ok) return beforeResult;

    let result: unknown;
    try {
      result = await this.adapter.invoke(command.invoke, parsed.data);
    } catch (error) {
      return err("APP_BUSY", messageFrom(error));
    }

    const afterResult = await this.captureAfter(command, parsed.data, result);
    if (!afterResult.ok) return afterResult;

    const commit = this.createCommit({
      command: action.command,
      args: parsed.data,
      before: beforeResult.value,
      after: afterResult.value,
      revertable: hasExecutableUndo,
      actor: options.actor ?? "agent",
      idempotencyKey: options.idempotencyKey,
    });

    if (hasExecutableUndo) {
      try {
        commit.inverse = command.undo!({
          args: parsed.data,
          before: commit.before,
          after: commit.after,
          commit,
        });
      } catch {
        // Revert can still attempt undo later and report a structured error.
      }
    }

    const executionResult = ok<ExecuteValue>({ result, commit });
    if (options.idempotencyKey) {
      this.idempotencyCache.set(options.idempotencyKey, executionResult);
    }
    return executionResult;
  }

  async revertCommit(commitId: string): Promise<IrisResult<ExecuteValue>> {
    const commit = this.commits.find((entry) => entry.commitId === commitId);
    if (!commit) {
      return err("UNSUPPORTED_COMMAND", `Unknown commit: ${commitId}`);
    }
    if (commit.status !== "active") {
      return err("UNSUPPORTED_COMMAND", `Commit is not active: ${commitId}`);
    }

    const command = this.commands[commit.command];
    if (!command || command.kind !== "writable" || !commit.revertable || !command.undo) {
      return err("UNSUPPORTED_COMMAND", `Commit is not revertable: ${commitId}`);
    }

    let undoAction: IrisAction;
    try {
      undoAction = commit.inverse ?? command.undo({
        args: commit.args,
        before: commit.before,
        after: commit.after,
        commit,
      });
    } catch (error) {
      return err("UNSUPPORTED_COMMAND", messageFrom(error));
    }

    const result = await this.execute(undoAction, { actor: "agent", confirmed: true });
    if (!result.ok) return result;

    commit.status = "reverted";
    if (result.value.commit) {
      result.value.commit.status = "revert";
      result.value.commit.linkedCommitId = commit.commitId;
      commit.linkedCommitId = result.value.commit.commitId;
    }
    return result;
  }

  private emitEvent(event: IrisEvent): void {
    this.eventLog.push(event);
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  private applyRedactions(state: Record<string, unknown>): Record<string, unknown> {
    const rules = this.policy.redactions;
    if (!rules || rules.length === 0) return state;
    return redactFields(state, rules) as Record<string, unknown>;
  }

  private toManifestCommand(name: string, command: InternalCommand): IrisManifestCommand {
    return {
      name,
      invoke: command.invoke,
      kind: command.kind,
      layer: command.layer,
      description: command.description,
      resource: command.kind === "writable" ? command.resource : undefined,
      risk: command.kind === "writable" ? command.risk : undefined,
      revertable: command.kind === "writable" ? command.revertable === true : false,
      confirm: command.kind === "writable" ? command.confirm : undefined,
      argsSchema: schemaToJson(command.args),
      commandVersion: command.commandVersion,
    };
  }

  private isBanned(commandName: string, invokeName: string): boolean {
    return (
      this.policy.bannedCommands?.includes(commandName) === true ||
      this.policy.bannedCommands?.includes(invokeName) === true
    );
  }

  private requiresPolicyConfirmation(commandName: string, invokeName: string): boolean {
    return (
      this.policy.confirmCommands?.includes(commandName) === true ||
      this.policy.confirmCommands?.includes(invokeName) === true
    );
  }

  private isRateLimited(commandName: string, invokeName: string): boolean {
    const rule =
      this.policy.rateLimits?.[commandName] ?? this.policy.rateLimits?.[invokeName];
    if (!rule) return false;

    const now = Date.now();
    const recent = (this.rateLimitLog.get(commandName) ?? []).filter(
      (timestamp) => now - timestamp < rule.windowMs,
    );
    if (recent.length >= rule.max) {
      this.rateLimitLog.set(commandName, recent);
      return true;
    }
    recent.push(now);
    this.rateLimitLog.set(commandName, recent);
    return false;
  }

  private async checkExpectedVersion<TArgs>(
    command: InternalWritableCommand<TArgs>,
    args: TArgs,
    expectedVersion: unknown,
  ): Promise<IrisResult<void>> {
    if (!command.getCurrentVersion || expectedVersion === undefined) return ok(undefined);
    try {
      const currentVersion = await command.getCurrentVersion({ args, adapter: this.adapter });
      if (!Object.is(currentVersion, expectedVersion)) {
        return err("STATE_CONFLICT", "Resource version does not match", {
          expectedVersion,
          currentVersion,
        });
      }
      return ok(undefined);
    } catch (error) {
      return err("APP_BUSY", messageFrom(error));
    }
  }

  private async captureBefore<TArgs>(
    command: InternalWritableCommand<TArgs>,
    args: TArgs,
  ): Promise<IrisResult<unknown>> {
    if (!command.captureBefore) return ok({ unavailable: true });
    try {
      return ok(await command.captureBefore({ args, adapter: this.adapter }));
    } catch (error) {
      return err("APP_BUSY", messageFrom(error));
    }
  }

  private async captureAfter<TArgs>(
    command: InternalWritableCommand<TArgs>,
    args: TArgs,
    adapterResult: unknown,
  ): Promise<IrisResult<unknown>> {
    if (!command.captureAfter) return ok({ result: adapterResult });
    try {
      return ok(await command.captureAfter({ args, adapter: this.adapter }));
    } catch (error) {
      return err("APP_BUSY", messageFrom(error));
    }
  }

  private createCommit(input: {
    command: string;
    args: unknown;
    before: unknown;
    after: unknown;
    revertable: boolean;
    actor: IrisActor;
    idempotencyKey?: string;
  }): IrisCommit {
    const commit: IrisCommit = {
      commitId: `commit_${String(++this.commitSequence).padStart(3, "0")}`,
      command: input.command,
      args: input.args,
      before: input.before,
      after: input.after,
      revertable: input.revertable,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      status: "active",
      idempotencyKey: input.idempotencyKey,
    };
    this.commits.push(commit);
    return commit;
  }
}

function ok<T>(value: T): IrisResult<T> {
  return { ok: true, value };
}

function err<T = never>(
  code: IrisErrorCode,
  message?: string,
  details?: unknown,
): IrisResult<T> {
  return { ok: false, error: { code, message, details } };
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redactFields(value: unknown, rules: IrisRedactionRule[]): unknown {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactFields(item, rules));
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const rule = rules.find((r) => r.field === key);
    result[key] = rule ? (rule.replacement ?? "[REDACTED]") : redactFields(val, rules);
  }
  return result;
}

function schemaToJson(schema: ZodType<unknown>): unknown {
  const zodNamespace = z as unknown as {
    toJSONSchema?: (schema: ZodType<unknown>) => unknown;
  };
  try {
    if (typeof zodNamespace.toJSONSchema === "function") {
      return zodNamespace.toJSONSchema(schema);
    }
  } catch {
    // Fall back to an intentionally small schema representation.
  }
  return { type: "object" };
}
