import React, { useEffect, useMemo, useState } from "react";
import type { IrisApp } from "@iris/core";
import type { IrisError, IrisEvent, IrisManifest, IrisPolicy } from "@iris/protocol";

export interface IrisDevtoolsProps {
  app: IrisApp;
  lastError?: IrisError;
}

type Tab = "manifest" | "commits" | "events" | "policy";

export function IrisDevtools({ app, lastError }: IrisDevtoolsProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>("manifest");
  const [refreshToken, setRefreshToken] = useState(0);
  const [events, setEvents] = useState<IrisEvent[]>(() => app.getEventLog());

  // Subscribe to live events.
  useEffect(() => {
    return app.subscribeToEvents((event) => {
      setEvents((prev) => [...prev, event]);
    });
  }, [app]);

  const manifest = useMemo<IrisManifest>(
    () => app.getManifest(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app, refreshToken],
  );
  const commits = useMemo(
    () => app.getCommits(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app, refreshToken],
  );
  const policy = useMemo<IrisPolicy>(
    () => app.getPolicy(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app, refreshToken],
  );

  const containerStyle: React.CSSProperties = {
    fontFamily: "system-ui, monospace",
    fontSize: 12,
    background: "#0f0f0f",
    color: "#e5e5e5",
    border: "1px solid #333",
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    maxHeight: 480,
  };
  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    background: "#1a1a1a",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  };
  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: "3px 10px",
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    background: activeTab === tab ? "#7c3aed" : "transparent",
    color: activeTab === tab ? "#fff" : "#aaa",
  });
  const refreshStyle: React.CSSProperties = {
    marginLeft: "auto",
    padding: "3px 10px",
    borderRadius: 4,
    border: "1px solid #444",
    background: "transparent",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 12,
  };
  const bodyStyle: React.CSSProperties = {
    overflow: "auto",
    padding: "10px 12px",
    flex: 1,
  };
  const preStyle: React.CSSProperties = {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    lineHeight: 1.6,
  };

  const TABS: Tab[] = ["manifest", "commits", "events", "policy"];

  return (
    <section data-iris-devtools style={containerStyle}>
      <header style={headerStyle}>
        <strong style={{ color: "#7c3aed", marginRight: 6 }}>iris</strong>
        {TABS.map((tab) => (
          <button key={tab} type="button" style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {tab}
            {tab === "events" && events.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  background: "#7c3aed",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "0 5px",
                  fontSize: 10,
                }}
              >
                {events.length}
              </span>
            )}
            {tab === "commits" && commits.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  background: "#374151",
                  color: "#e5e5e5",
                  borderRadius: 8,
                  padding: "0 5px",
                  fontSize: 10,
                }}
              >
                {commits.length}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          style={refreshStyle}
          onClick={() => setRefreshToken((n) => n + 1)}
        >
          ↺
        </button>
        {lastError && (
          <span style={{ marginLeft: 8, color: "#f87171", fontSize: 11 }}>
            ✕ {lastError.code}
          </span>
        )}
      </header>

      <div style={bodyStyle}>
        {activeTab === "manifest" && (
          <pre style={preStyle}>{JSON.stringify(manifest, null, 2)}</pre>
        )}

        {activeTab === "commits" && (
          commits.length === 0 ? (
            <span style={{ color: "#555" }}>No commits yet.</span>
          ) : (
            <pre style={preStyle}>{JSON.stringify(commits, null, 2)}</pre>
          )
        )}

        {activeTab === "events" && (
          events.length === 0 ? (
            <span style={{ color: "#555" }}>No domain events received yet.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...events].reverse().map((event, i) => (
                <div
                  key={i}
                  style={{
                    background: "#1a1a1a",
                    borderRadius: 4,
                    padding: "6px 8px",
                    borderLeft: "3px solid #7c3aed",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                    <strong style={{ color: "#a78bfa" }}>{event.name}</strong>
                    <span style={{ color: "#555" }}>{event.timestamp}</span>
                  </div>
                  {event.payload !== undefined && (
                    <pre style={{ ...preStyle, color: "#9ca3af", fontSize: 11 }}>
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "policy" && (
          Object.keys(policy).length === 0 ? (
            <span style={{ color: "#555" }}>No policy configured.</span>
          ) : (
            <pre style={preStyle}>{JSON.stringify(policy, null, 2)}</pre>
          )
        )}
      </div>
    </section>
  );
}
