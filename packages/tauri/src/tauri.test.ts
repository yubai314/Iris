import { describe, expect, it, vi } from "vitest";
import { tauriAdapter } from "./index";

describe("@iris/tauri", () => {
  it("forwards command and args to injected invoke", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const adapter = tauriAdapter({ invoke });

    const result = await adapter.invoke("move_item", { id: "1" });

    expect(result).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("move_item", { id: "1" });
  });
});
