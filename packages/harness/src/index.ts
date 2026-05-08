import type { IrisApp } from "@iris/core";
import type { IrisAction, IrisResult } from "@iris/protocol";

export interface IrisHarnessOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

export type HarnessModelOutput =
  | { type: "action"; command: string; args: unknown }
  | { type: "none"; reason: string };

export interface RunTaskOptions {
  app: IrisApp;
  instruction: string;
}

export interface RunTaskValue {
  modelOutput: HarnessModelOutput;
  execution?: unknown;
}

export interface RunTaskLoopOptions {
  app: IrisApp;
  instruction: string;
  /**
   * Maximum number of LLM → execute steps before stopping.
   * Defaults to 10.
   */
  maxSteps?: number;
}

export interface RunTaskLoopStep {
  modelOutput: HarnessModelOutput;
  execution?: unknown;
}

export interface RunTaskLoopValue {
  steps: RunTaskLoopStep[];
  stepsExecuted: number;
}

const SYSTEM_PROMPT = `You are controlling an app through iris.
You may only output one JSON object.
Do not explain.
Do not invent commands.
Use only commands listed in the manifest.
If no valid action is possible, output {"type":"none","reason":"..."}.`;

const LOOP_SYSTEM_PROMPT = `You are controlling an app through iris to complete a multi-step task.
On each turn you receive the current world state and a summary of steps already taken.
Output exactly one JSON object per turn.
Do not invent commands. Use only commands listed in the manifest.
When the task is complete or no further action is possible, output {"type":"none","reason":"..."}.`;

export function createIrisHarness(options: IrisHarnessOptions): IrisHarness {
  return new IrisHarness(options);
}

export class IrisHarness {
  private readonly options: IrisHarnessOptions;

  constructor(options: IrisHarnessOptions) {
    this.options = options;
  }

  /** Single-step execution: one LLM call → one execute. */
  async runTask(options: RunTaskOptions): Promise<IrisResult<RunTaskValue>> {
    const manifest = options.app.getManifest();
    const world = await options.app.getWorld();
    const content = await this.callModel(
      SYSTEM_PROMPT,
      {
        instruction: options.instruction,
        manifest: slimManifest(manifest.commands),
        world,
      },
    );
    if (!content.ok) return content;

    const parsed = parseModelOutput(content.value);
    if (!parsed.ok) return parsed;

    const modelOutput = parsed.value;
    if (modelOutput.type === "none") {
      return { ok: true, value: { modelOutput } };
    }

    const knownCommand = manifest.commands.some((c) => c.name === modelOutput.command);
    if (!knownCommand) {
      return {
        ok: false,
        error: {
          code: "UNSUPPORTED_COMMAND",
          message: `Model requested unknown command: ${modelOutput.command}`,
        },
      };
    }

    const execution = await options.app.execute(
      { command: modelOutput.command, args: modelOutput.args } satisfies IrisAction,
      { actor: "agent" },
    );
    if (!execution.ok) return execution;

    return { ok: true, value: { modelOutput, execution: execution.value } };
  }

  /**
   * Multi-step execution loop: repeatedly calls the LLM and executes actions
   * until the model outputs `{type:"none"}` or `maxSteps` is reached.
   */
  async runTaskLoop(
    options: RunTaskLoopOptions,
  ): Promise<IrisResult<RunTaskLoopValue>> {
    const maxSteps = options.maxSteps ?? 10;
    const steps: RunTaskLoopStep[] = [];

    for (let i = 0; i < maxSteps; i++) {
      const manifest = options.app.getManifest();
      const world = await options.app.getWorld();

      const content = await this.callModel(
        LOOP_SYSTEM_PROMPT,
        {
          instruction: options.instruction,
          manifest: slimManifest(manifest.commands),
          world,
          stepsSoFar: steps.map((s, idx) => ({
            step: idx + 1,
            command: s.modelOutput.type === "action" ? s.modelOutput.command : null,
            args: s.modelOutput.type === "action" ? s.modelOutput.args : null,
          })),
        },
      );
      if (!content.ok) return content;

      const parsed = parseModelOutput(content.value);
      if (!parsed.ok) return parsed;

      const modelOutput = parsed.value;

      if (modelOutput.type === "none") {
        steps.push({ modelOutput });
        break;
      }

      const knownCommand = manifest.commands.some((c) => c.name === modelOutput.command);
      if (!knownCommand) {
        return {
          ok: false,
          error: {
            code: "UNSUPPORTED_COMMAND",
            message: `Model requested unknown command: ${modelOutput.command}`,
          },
        };
      }

      const execution = await options.app.execute(
        { command: modelOutput.command, args: modelOutput.args } satisfies IrisAction,
        { actor: "agent" },
      );
      if (!execution.ok) return execution;

      steps.push({ modelOutput, execution: execution.value });
    }

    return { ok: true, value: { steps, stepsExecuted: steps.length } };
  }

  private async callModel(
    systemPrompt: string,
    payload: unknown,
  ): Promise<IrisResult<string>> {
    const requestFetch = this.options.fetch ?? fetch;
    const response = await requestFetch(
      `${trimSlash(this.options.baseUrl)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(payload) },
          ],
          temperature: 0,
        }),
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: "APP_BUSY",
          message: `Model request failed with status ${response.status}`,
        },
      };
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return {
        ok: false,
        error: {
          code: "MODEL_OUTPUT_INVALID",
          message: "Model response did not include message content",
        },
      };
    }
    return { ok: true, value: content };
  }
}

export function getIrisHarnessSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function getIrisHarnessLoopSystemPrompt(): string {
  return LOOP_SYSTEM_PROMPT;
}

function slimManifest(
  commands: ReturnType<IrisApp["getManifest"]>["commands"],
): unknown {
  return commands.map((c) => ({
    name: c.name,
    kind: c.kind,
    description: c.description,
    argsSchema: c.argsSchema,
  }));
}

function parseModelOutput(content: string): IrisResult<HarnessModelOutput> {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return {
      ok: false,
      error: {
        code: "MODEL_OUTPUT_INVALID",
        message: "Model output was not valid JSON",
      },
    };
  }

  if (!value || typeof value !== "object") return invalidOutput();

  const output = value as Record<string, unknown>;
  if (output.type === "none" && typeof output.reason === "string") {
    return { ok: true, value: { type: "none", reason: output.reason } };
  }
  if (output.type === "action" && typeof output.command === "string") {
    return {
      ok: true,
      value: { type: "action", command: output.command, args: output.args ?? {} },
    };
  }
  return invalidOutput();
}

function invalidOutput(): IrisResult<HarnessModelOutput> {
  return {
    ok: false,
    error: {
      code: "MODEL_OUTPUT_INVALID",
      message: "Model output did not match iris harness schema",
    },
  };
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
