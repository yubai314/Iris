import { describe, expect, it, vi } from "vitest";
import { defineIrisApp, writable, z } from "@iris/core";
import { createIrisHarness } from "./index";
import type { IrisPlatformAdapter } from "@iris/protocol";

function jsonResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("@iris/harness", () => {
  it("executes valid model actions through the executor", async () => {
    const adapter: IrisPlatformAdapter = {
      platform: "tauri",
      invoke: vi.fn(async () => ({ ok: true })),
    };
    const app = defineIrisApp({
      platform: "tauri",
      adapter,
      commands: {
        deleteItem: writable({
          invoke: "delete_item",
          args: z.object({ id: z.string() }),
        }),
      },
    });
    const fetchMock = vi.fn(async () =>
      jsonResponse(JSON.stringify({ type: "action", command: "deleteItem", args: { id: "1" } })),
    );
    const harness = createIrisHarness({
      baseUrl: "https://example.test/v1",
      apiKey: "test",
      model: "test-model",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await harness.runTask({ app, instruction: "delete item" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("USER_CONFIRM_REQUIRED");
    expect(adapter.invoke).not.toHaveBeenCalled();
  });

  it("rejects non-json model output", async () => {
    const app = defineIrisApp({
      platform: "tauri",
      adapter: { platform: "tauri", invoke: async () => null },
      commands: {},
    });
    const harness = createIrisHarness({
      baseUrl: "https://example.test/v1",
      apiKey: "test",
      model: "test-model",
      fetch: vi.fn(async () => jsonResponse("not json")) as unknown as typeof fetch,
    });

    const result = await harness.runTask({ app, instruction: "noop" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MODEL_OUTPUT_INVALID");
  });

  it("rejects unknown commands before execution", async () => {
    const adapter: IrisPlatformAdapter = {
      platform: "tauri",
      invoke: vi.fn(async () => null),
    };
    const app = defineIrisApp({ platform: "tauri", adapter, commands: {} });
    const harness = createIrisHarness({
      baseUrl: "https://example.test/v1",
      apiKey: "test",
      model: "test-model",
      fetch: vi.fn(async () =>
        jsonResponse(JSON.stringify({ type: "action", command: "missing", args: {} })),
      ) as unknown as typeof fetch,
    });

    const result = await harness.runTask({ app, instruction: "do it" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_COMMAND");
    expect(adapter.invoke).not.toHaveBeenCalled();
  });

  it("does not execute when model returns none", async () => {
    const adapter: IrisPlatformAdapter = {
      platform: "tauri",
      invoke: vi.fn(async () => null),
    };
    const app = defineIrisApp({ platform: "tauri", adapter, commands: {} });
    const harness = createIrisHarness({
      baseUrl: "https://example.test/v1",
      apiKey: "test",
      model: "test-model",
      fetch: vi.fn(async () =>
        jsonResponse(JSON.stringify({ type: "none", reason: "no command" })),
      ) as unknown as typeof fetch,
    });

    const result = await harness.runTask({ app, instruction: "do it" });

    expect(result.ok).toBe(true);
    expect(adapter.invoke).not.toHaveBeenCalled();
  });
});
