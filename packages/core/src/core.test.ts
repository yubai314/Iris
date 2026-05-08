import { describe, expect, it, vi } from "vitest";
import { defineIrisApp, readable, writable, z } from "./index";
import type { IrisPlatformAdapter } from "@iris/protocol";

function mockAdapter(
  handler: (command: string, args: unknown) => Promise<unknown> | unknown,
): IrisPlatformAdapter {
  return {
    platform: "tauri",
    invoke: vi.fn(async (command, args) => handler(command, args)),
  };
}

describe("@iris/core executor", () => {
  it("does not create commits for readable commands", async () => {
    const adapter = mockAdapter(() => [{ id: "item_1" }]);
    const app = defineIrisApp({
      platform: "tauri",
      adapter,
      commands: {
        listItems: readable({
          invoke: "list_items",
          args: z.object({}),
        }),
      },
    });

    const result = await app.execute({ command: "listItems", args: {} });

    expect(result.ok).toBe(true);
    expect(app.getCommits()).toHaveLength(0);
  });

  it("returns UNSUPPORTED_COMMAND for unknown commands", async () => {
    const app = defineIrisApp({
      platform: "tauri",
      adapter: mockAdapter(() => null),
      commands: {},
    });

    const result = await app.execute({ command: "missing", args: {} });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("applies policy bans before confirm checks", async () => {
    const app = defineIrisApp({
      platform: "tauri",
      adapter: mockAdapter(() => null),
      commands: {
        purge: writable({
          invoke: "purge",
          confirm: "required",
          args: z.object({ id: z.string() }),
        }),
      },
    });
    app.setPolicy({ bannedCommands: ["purge"] });

    const result = await app.execute({ command: "purge", args: { id: "1" } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PERMISSION_DENIED");
  });

  it("returns SCHEMA_INVALID for invalid args", async () => {
    const app = defineIrisApp({
      platform: "tauri",
      adapter: mockAdapter(() => null),
      commands: {
        move: writable({
          invoke: "move",
          args: z.object({ id: z.string() }),
        }),
      },
    });

    const result = await app.execute({ command: "move", args: { id: 1 } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("SCHEMA_INVALID");
  });

  it("requires confirmation for no-undo writable commands", async () => {
    const app = defineIrisApp({
      platform: "tauri",
      adapter: mockAdapter(() => ({ ok: true })),
      commands: {
        deleteItem: writable({
          invoke: "delete_item",
          args: z.object({ id: z.string() }),
        }),
      },
    });

    const result = await app.execute({ command: "deleteItem", args: { id: "1" } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("USER_CONFIRM_REQUIRED");
  });

  it("executes confirmed no-undo writable commands and creates non-revertable commits", async () => {
    const adapter = mockAdapter(() => ({ ok: true }));
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

    const result = await app.execute(
      { command: "deleteItem", args: { id: "1" } },
      { confirmed: true },
    );

    expect(result.ok).toBe(true);
    expect(adapter.invoke).toHaveBeenCalledOnce();
    expect(app.getCommits()[0]?.revertable).toBe(false);
  });

  it("does not repeat adapter invocation for matching idempotency keys", async () => {
    const adapter = mockAdapter(() => ({ ok: true }));
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

    await app.execute(
      { command: "deleteItem", args: { id: "1" } },
      { confirmed: true, idempotencyKey: "same" },
    );
    await app.execute(
      { command: "deleteItem", args: { id: "1" } },
      { confirmed: true, idempotencyKey: "same" },
    );

    expect(adapter.invoke).toHaveBeenCalledOnce();
    expect(app.getCommits()).toHaveLength(1);
  });

  it("does not run readable commands before writable commands unless captureBefore is declared", async () => {
    const adapter = mockAdapter((command) => {
      if (command === "list_items") throw new Error("should not be called");
      return { ok: true };
    });
    const app = defineIrisApp({
      platform: "tauri",
      adapter,
      commands: {
        listItems: readable({
          invoke: "list_items",
          args: z.object({}),
        }),
        deleteItem: writable({
          invoke: "delete_item",
          args: z.object({ id: z.string() }),
        }),
      },
    });

    const result = await app.execute(
      { command: "deleteItem", args: { id: "1" } },
      { confirmed: true },
    );

    expect(result.ok).toBe(true);
    expect(adapter.invoke).toHaveBeenCalledWith("delete_item", { id: "1" });
  });

  it("prevents writable invocation when captureBefore fails", async () => {
    const adapter = mockAdapter(() => ({ ok: true }));
    const app = defineIrisApp({
      platform: "tauri",
      adapter,
      commands: {
        moveItem: writable({
          invoke: "move_item",
          revertable: true,
          args: z.object({ id: z.string(), target: z.string() }),
          captureBefore: async () => {
            throw new Error("database busy");
          },
          undo: ({ args }) => ({ command: "moveItem", args }),
        }),
      },
    });

    const result = await app.execute({
      command: "moveItem",
      args: { id: "1", target: "later" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("APP_BUSY");
    expect(adapter.invoke).not.toHaveBeenCalled();
  });

  it("reverts using hand-written undo and links the revert commit", async () => {
    const adapter = mockAdapter(() => ({ ok: true }));
    const app = defineIrisApp({
      platform: "tauri",
      adapter,
      commands: {
        moveItem: writable({
          invoke: "move_item",
          revertable: true,
          args: z.object({ id: z.string(), target: z.string() }),
          captureBefore: async () => ({ containerId: "unread" }),
          undo: ({ args, before }) => ({
            command: "moveItem",
            args: { id: args.id, target: (before as { containerId: string }).containerId },
          }),
        }),
      },
    });

    const executed = await app.execute({
      command: "moveItem",
      args: { id: "1", target: "later" },
    });
    expect(executed.ok).toBe(true);
    const originalCommit = app.getCommits()[0]!;

    const reverted = await app.revertCommit(originalCommit.commitId);

    expect(reverted.ok).toBe(true);
    const commits = app.getCommits();
    expect(commits).toHaveLength(2);
    expect(commits[0]?.status).toBe("reverted");
    expect(commits[1]?.status).toBe("revert");
    expect(commits[0]?.linkedCommitId).toBe(commits[1]?.commitId);
  });

  it("does not mutate original commit status when undo fails from missing before state", async () => {
    const adapter = mockAdapter(() => ({ ok: true }));
    const app = defineIrisApp({
      platform: "tauri",
      adapter,
      commands: {
        moveItem: writable({
          invoke: "move_item",
          revertable: true,
          args: z.object({ id: z.string(), target: z.string() }),
          undo: ({ args, before }) => ({
            command: "moveItem",
            args: {
              id: args.id,
              target: (before as { containerId: string }).containerId.toUpperCase(),
            },
          }),
        }),
      },
    });

    const executed = await app.execute({
      command: "moveItem",
      args: { id: "1", target: "later" },
    });
    expect(executed.ok).toBe(true);
    const originalCommit = app.getCommits()[0]!;

    const reverted = await app.revertCommit(originalCommit.commitId);

    expect(reverted.ok).toBe(false);
    if (!reverted.ok) expect(reverted.error.code).toBe("UNSUPPORTED_COMMAND");
    expect(app.getCommits()[0]?.status).toBe("active");
    expect(app.getCommits()).toHaveLength(1);
  });
});
