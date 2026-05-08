import React from "react";
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { collectIrisSnapshot, IrisProvider, useIrisOverlay } from "./index";
import { defineIrisApp } from "@iris/core";
import type { IrisPlatformAdapter } from "@iris/protocol";

describe("@iris/react", () => {
  it("collects data-iris-id elements", () => {
    document.body.innerHTML = `<button data-iris-id="item:1" role="button">Move me</button>`;

    const snapshot = collectIrisSnapshot();

    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0]?.id).toBe("item:1");
    expect(snapshot.nodes[0]?.text).toBe("Move me");
  });

  it("excludes data-iris-blind content", () => {
    document.body.innerHTML = `
      <div data-iris-blind>
        <button data-iris-id="secret">Secret</button>
      </div>
    `;

    const snapshot = collectIrisSnapshot();

    expect(snapshot.nodes).toHaveLength(0);
  });

  it("redacts data-iris-redact content", () => {
    document.body.innerHTML = `
      <div data-iris-id="user:1">
        Email <span data-iris-redact="email">user@example.com</span>
      </div>
    `;

    const snapshot = collectIrisSnapshot();

    expect(snapshot.nodes[0]?.text).toContain("[REDACTED_EMAIL]");
    expect(snapshot.nodes[0]?.text).not.toContain("user@example.com");
  });

  it("renders overlay for active component id", () => {
    const adapter: IrisPlatformAdapter = {
      platform: "tauri",
      invoke: async () => null,
    };
    const app = defineIrisApp({ platform: "tauri", adapter, commands: {} });

    function OverlaySetter(): React.ReactElement {
      const overlay = useIrisOverlay();
      React.useEffect(() => {
        overlay.setActiveId("item:1");
      }, [overlay]);
      return <div data-iris-id="item:1">Item</div>;
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <IrisProvider app={app}>
          <OverlaySetter />
        </IrisProvider>,
      );
    });

    expect(container.querySelector("[data-iris-overlay='item:1']")).not.toBeNull();
  });
});
