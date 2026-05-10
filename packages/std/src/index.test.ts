import { describe, expect, it, vi } from "vitest";
import { defineIrisApp } from "@iris/core";
import type { IrisPlatformAdapter } from "@iris/protocol";
import { stdOp } from "./index";

function makeAdapter(): IrisPlatformAdapter {
  return { platform: "electron", invoke: vi.fn(async () => null) };
}

describe("@iris/std — stdOp factories", () => {
  it("itemArchive produces a reversible writable command", () => {
    const adapter = makeAdapter();
    const app = defineIrisApp({
      platform: "electron",
      adapter,
      commands: { archiveItem: stdOp.itemArchive({ invoke: "archive_item" }) },
    });
    const manifest = app.getManifest();
    const cmd = manifest.commands.find((c) => c.name === "archiveItem")!;
    expect(cmd.kind).toBe("writable");
    expect(cmd.risk).toBe("reversible");
    expect(cmd.revertable).toBe(true);
    expect(cmd.confirm).toBeUndefined();
  });

  it("itemDelete is irreversible and requires confirmation", () => {
    const adapter = makeAdapter();
    const app = defineIrisApp({
      platform: "electron",
      adapter,
      commands: { deleteItem: stdOp.itemDelete({ invoke: "delete_item" }) },
    });
    const manifest = app.getManifest();
    const cmd = manifest.commands.find((c) => c.name === "deleteItem")!;
    expect(cmd.risk).toBe("irreversible");
    expect(cmd.revertable).toBe(false);
    expect(cmd.confirm).toBe("required");
  });

  it("collectionRemove is destructive and requires confirmation", () => {
    const adapter = makeAdapter();
    const app = defineIrisApp({
      platform: "electron",
      adapter,
      commands: { removeCollection: stdOp.collectionRemove({ invoke: "remove_collection" }) },
    });
    const manifest = app.getManifest();
    const cmd = manifest.commands.find((c) => c.name === "removeCollection")!;
    expect(cmd.risk).toBe("destructive");
    expect(cmd.confirm).toBe("required");
  });

  it("batchMove accepts ids array and targetId", async () => {
    const adapter = makeAdapter();
    const app = defineIrisApp({
      platform: "electron",
      adapter,
      commands: { batchMove: stdOp.batchMove({ invoke: "batch_move" }) },
    });
    const result = await app.execute(
      { command: "batchMove", args: { ids: ["a", "b"], targetId: "col-1" } },
      { actor: "agent", confirmed: true },
    );
    expect(result.ok).toBe(true);
    expect(adapter.invoke).toHaveBeenCalledWith("batch_move", { ids: ["a", "b"], targetId: "col-1" });
  });

  it("accepts a custom description override", () => {
    const adapter = makeAdapter();
    const app = defineIrisApp({
      platform: "electron",
      adapter,
      commands: {
        archiveItem: stdOp.itemArchive({
          invoke: "archive_item",
          description: "Custom archive description",
        }),
      },
    });
    const cmd = app.getManifest().commands[0]!;
    expect(cmd.description).toBe("Custom archive description");
  });

  it("all fourteen operations produce valid commands", () => {
    const ops = [
      stdOp.itemArchive({ invoke: "a" }),
      stdOp.itemUnarchive({ invoke: "a" }),
      stdOp.itemFlag({ invoke: "a" }),
      stdOp.itemUnflag({ invoke: "a" }),
      stdOp.itemMove({ invoke: "a" }),
      stdOp.itemTag({ invoke: "a" }),
      stdOp.itemDelete({ invoke: "a" }),
      stdOp.collectionAdd({ invoke: "a" }),
      stdOp.collectionRename({ invoke: "a" }),
      stdOp.collectionRemove({ invoke: "a" }),
      stdOp.batchMove({ invoke: "a" }),
      stdOp.batchArchive({ invoke: "a" }),
      stdOp.batchTag({ invoke: "a" }),
      stdOp.batchDelete({ invoke: "a" }),
    ];
    expect(ops).toHaveLength(14);
    for (const op of ops) {
      expect(op.kind).toBe("writable");
      expect(op.invoke).toBe("a");
    }
  });
});
