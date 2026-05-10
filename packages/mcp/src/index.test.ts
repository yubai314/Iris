import { describe, expect, it, vi } from "vitest";
import { defineIrisApp, readable, writable, z } from "@iris/core";
import type { IrisPlatformAdapter } from "@iris/protocol";
import { buildToolList, callTool } from "./index";

function makeAdapter(invokeImpl?: (cmd: string, args: unknown) => unknown): IrisPlatformAdapter {
  return {
    platform: "electron",
    invoke: vi.fn(async (cmd, args) => invokeImpl?.(cmd, args) ?? null),
  };
}

function makeApp(adapter = makeAdapter()) {
  return defineIrisApp({
    platform: "electron",
    adapter,
    commands: {
      getItems: readable({
        invoke: "get_items",
        description: "Get all items",
        args: z.object({}),
        returns: z.array(z.string()),
      }),
      moveItem: writable({
        invoke: "move_item",
        description: "Move an item to a group",
        resource: "item",
        risk: "reversible",
        revertable: true,
        args: z.object({ id: z.string(), targetGroupId: z.string() }),
      }),
      deleteItem: writable({
        invoke: "delete_item",
        description: "Permanently delete an item",
        resource: "item",
        risk: "irreversible",
        revertable: false,
        confirm: "required",
        args: z.object({ id: z.string() }),
      }),
    },
  });
}

describe("buildToolList", () => {
  it("always includes the three built-in iris tools", () => {
    const app = makeApp();
    const tools = buildToolList(app);
    const names = tools.map((t) => t.name);
    expect(names).toContain("iris_world");
    expect(names).toContain("iris_commits");
    expect(names).toContain("iris_revert");
  });

  it("includes a tool for each declared command", () => {
    const app = makeApp();
    const tools = buildToolList(app);
    const names = tools.map((t) => t.name);
    expect(names).toContain("getItems");
    expect(names).toContain("moveItem");
    expect(names).toContain("deleteItem");
  });

  it("injects _confirmed field into writable command schemas", () => {
    const app = makeApp();
    const tools = buildToolList(app);
    const moveItem = tools.find((t) => t.name === "moveItem")!;
    const schema = moveItem.inputSchema as { properties: Record<string, unknown> };
    expect(schema.properties).toHaveProperty("_confirmed");
  });

  it("does not inject _confirmed into readable command schemas", () => {
    const app = makeApp();
    const tools = buildToolList(app);
    const getItems = tools.find((t) => t.name === "getItems")!;
    const schema = getItems.inputSchema as { properties: Record<string, unknown> };
    expect(schema.properties).not.toHaveProperty("_confirmed");
  });

  it("includes risk and revertable info in writable descriptions", () => {
    const app = makeApp();
    const tools = buildToolList(app);
    const moveItem = tools.find((t) => t.name === "moveItem")!;
    expect(moveItem.description).toContain("reversible");
    expect(moveItem.description).toContain("Revertable");
  });
});

describe("callTool — iris_world", () => {
  it("returns the world state as JSON", async () => {
    const adapter = makeAdapter(() => ["item-1"]);
    const app = makeApp(adapter);
    const result = await callTool(app, "iris_world", {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("manifest");
    expect(parsed).toHaveProperty("readable");
  });
});

describe("callTool — iris_commits", () => {
  it("returns an empty array when no commits exist", async () => {
    const app = makeApp();
    const result = await callTool(app, "iris_commits", {});
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toEqual([]);
  });
});

describe("callTool — iris_revert", () => {
  it("returns error for unknown commitId", async () => {
    const app = makeApp();
    const result = await callTool(app, "iris_revert", { commitId: "nonexistent" });
    expect(result.isError).toBe(true);
  });

  it("returns error when commitId is missing", async () => {
    const app = makeApp();
    const result = await callTool(app, "iris_revert", {});
    expect(result.isError).toBe(true);
  });
});

describe("callTool — declared commands", () => {
  it("executes a readable command and returns the result", async () => {
    const adapter = makeAdapter(() => ["item-a", "item-b"]);
    const app = makeApp(adapter);
    const result = await callTool(app, "getItems", {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("result");
  });

  it("returns needsConfirm for a revertable writable without confirmation", async () => {
    const adapter = makeAdapter();
    const app = makeApp(adapter);
    const result = await callTool(app, "moveItem", { id: "item-1", targetGroupId: "col-1" });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.needsConfirm).toBe(true);
  });

  it("executes a revertable writable when _confirmed: true", async () => {
    const adapter = makeAdapter();
    const app = makeApp(adapter);
    const result = await callTool(app, "moveItem", {
      id: "item-1",
      targetGroupId: "col-1",
      _confirmed: true,
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).not.toHaveProperty("needsConfirm");
    expect(adapter.invoke).toHaveBeenCalledWith("move_item", { id: "item-1", targetGroupId: "col-1" });
  });

  it("strips _confirmed from args passed to the adapter", async () => {
    const adapter = makeAdapter();
    const app = makeApp(adapter);
    await callTool(app, "moveItem", {
      id: "item-1",
      targetGroupId: "col-1",
      _confirmed: true,
    });
    expect(adapter.invoke).toHaveBeenCalledWith("move_item", {
      id: "item-1",
      targetGroupId: "col-1",
    });
  });

  it("returns needsConfirm for confirm:required command without _confirmed", async () => {
    const adapter = makeAdapter();
    const app = makeApp(adapter);
    const result = await callTool(app, "deleteItem", { id: "item-1" });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.needsConfirm).toBe(true);
  });

  it("returns error for unknown tool name", async () => {
    const app = makeApp();
    const result = await callTool(app, "nonExistentTool", {});
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("returns error when args fail schema validation", async () => {
    const app = makeApp();
    const result = await callTool(app, "moveItem", { id: 42, targetGroupId: "col-1" });
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error.code).toBe("SCHEMA_INVALID");
  });
});
