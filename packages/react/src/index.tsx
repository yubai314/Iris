import React, {
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IrisApp, IrisAction, ExecuteOptions, ExecuteValue } from "@iris/core";
import type {
  IrisCommit,
  IrisHighlight,
  IrisHighlightPhase,
  IrisHighlightRole,
  IrisProgressPayload,
  IrisResult,
  IrisScopeToken,
} from "@iris/protocol";

export type { IrisHighlight, IrisHighlightPhase, IrisHighlightRole };

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface IrisSnapshotNode {
  id: string;
  text: string;
  role?: string | null;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface IrisDomSnapshot {
  nodes: IrisSnapshotNode[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface IrisOverlayState {
  highlights: readonly IrisHighlight[];
  setHighlights(highlights: IrisHighlight[]): void;
  clearHighlights(): void;
  /** @deprecated use setHighlights */
  activeId?: string;
  /** @deprecated use setHighlights */
  setActiveId(id?: string): void;
}

export interface IrisScopeState {
  enabledIds: ReadonlySet<string>;
  toggleId(id: string): void;
  enableAll(ids: string[]): void;
  disableAll(): void;
  generateToken(): IrisScopeToken;
}

export interface IrisReactContextValue {
  app: IrisApp;
  snapshot: IrisDomSnapshot;
  refreshSnapshot(): IrisDomSnapshot;
  overlay: IrisOverlayState;
  scope: IrisScopeState;
  /**
   * Execute an action through the app. If the executor returns
   * USER_CONFIRM_REQUIRED and no `confirmed` option is set, a built-in (or
   * custom) confirmation dialog is shown. The promise resolves once the user
   * confirms or cancels.
   */
  executeWithConfirm(
    action: IrisAction,
    options?: ExecuteOptions,
  ): Promise<IrisResult<ExecuteValue>>;
}

const IrisContext = createContext<IrisReactContextValue | null>(null);

// ---------------------------------------------------------------------------
// Confirm dialog types
// ---------------------------------------------------------------------------

export interface IrisConfirmRenderProps {
  command: string;
  onConfirm(): void;
  onCancel(): void;
}

interface PendingConfirm {
  command: string;
  resolve(confirmed: boolean): void;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface IrisProviderProps {
  app: IrisApp;
  children: ReactNode;
  /** Replace the built-in confirmation dialog with a custom renderer. */
  renderConfirm?: (props: IrisConfirmRenderProps) => React.ReactNode;
}

export function IrisProvider({
  app,
  children,
  renderConfirm,
}: IrisProviderProps): React.ReactElement {
  const [snapshot, setSnapshot] = useState<IrisDomSnapshot>(() => collectIrisSnapshot());
  const [highlights, setHighlightsState] = useState<IrisHighlight[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<{ command: string } | null>(null);
  const pendingConfirmRef = useRef<PendingConfirm | null>(null);
  const [enabledIds, setEnabledIds] = useState<ReadonlySet<string>>(new Set());

  const [progressTick, setProgressTick] = useState(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return app.subscribeToEvents((event) => {
      if (event.kind === "progress") {
        setProgressTick((n) => n + 1);
      }
      if (event.kind === "highlight") {
        const payload = event.payload as { highlights: IrisHighlight[] };
        const allDone = payload.highlights.every((h) => h.phase === "done");
        setHighlightsState(payload.highlights);
        if (allDone) {
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => setHighlightsState([]), 700);
        }
      }
    });
  }, [app]);

  const askConfirm = useCallback((command: string): Promise<boolean> => {
    return new Promise((resolve) => {
      pendingConfirmRef.current = { command, resolve };
      setPendingConfirm({ command });
    });
  }, []);

  const settleConfirm = useCallback((confirmed: boolean) => {
    const pending = pendingConfirmRef.current;
    if (!pending) return;
    pendingConfirmRef.current = null;
    setPendingConfirm(null);
    pending.resolve(confirmed);
  }, []);

  const executeWithConfirm = useCallback(
    async (
      action: IrisAction,
      options: ExecuteOptions = {},
    ): Promise<IrisResult<ExecuteValue>> => {
      const result = await app.execute(action, options);
      if (!result.ok && result.error.code === "USER_CONFIRM_REQUIRED") {
        const confirmed = await askConfirm(action.command);
        if (!confirmed) return result;
        return app.execute(action, { ...options, confirmed: true });
      }
      return result;
    },
    [app, askConfirm],
  );

  const scope = useMemo<IrisScopeState>(
    () => ({
      enabledIds,
      toggleId(id: string) {
        setEnabledIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      enableAll(ids: string[]) {
        setEnabledIds(new Set(ids));
      },
      disableAll() {
        setEnabledIds(new Set());
      },
      generateToken(): IrisScopeToken {
        return {
          sessionId: crypto.randomUUID(),
          enabledIds: [...enabledIds],
          issuedAt: new Date().toISOString(),
        };
      },
    }),
    [enabledIds],
  );

  const setHighlights = useCallback<IrisOverlayState["setHighlights"]>(
    (next) => setHighlightsState(next),
    [],
  );
  const clearHighlights = useCallback(() => setHighlightsState([]), []);
  const legacySetActiveId = useCallback((id?: string) => {
    setHighlightsState((prev) => {
      if (!id) return prev.length === 0 ? prev : [];
      if (prev.length === 1 && prev[0]!.id === id && prev[0]!.phase === "active") return prev;
      return [{ id, phase: "active" as const }];
    });
  }, []);

  const overlay = useMemo<IrisOverlayState>(
    () => ({
      highlights,
      setHighlights,
      clearHighlights,
      activeId: highlights.find((h) => h.phase === "active")?.id,
      setActiveId: legacySetActiveId,
    }),
    [highlights, setHighlights, clearHighlights, legacySetActiveId],
  );

  const value = useMemo<IrisReactContextValue>(
    () => ({
      app,
      snapshot,
      refreshSnapshot() {
        const next = collectIrisSnapshot();
        setSnapshot(next);
        return next;
      },
      overlay,
      scope,
      executeWithConfirm,
    }),
    [app, executeWithConfirm, overlay, scope, snapshot],
  );

  return (
    <IrisContext.Provider value={value}>
      {children}
      <IrisOverlay highlights={highlights} progressTick={progressTick} />
      {pendingConfirm &&
        (renderConfirm ? (
          renderConfirm({
            command: pendingConfirm.command,
            onConfirm: () => settleConfirm(true),
            onCancel: () => settleConfirm(false),
          })
        ) : (
          <IrisDefaultConfirmDialog
            command={pendingConfirm.command}
            onConfirm={() => settleConfirm(true)}
            onCancel={() => settleConfirm(false)}
          />
        ))}
    </IrisContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useIris(): IrisReactContextValue {
  const context = useContext(IrisContext);
  if (!context) throw new Error("useIris must be used inside IrisProvider");
  return context;
}

export function useIrisSnapshot(): IrisDomSnapshot {
  return useIris().snapshot;
}

export function useIrisOverlay(): IrisOverlayState {
  return useIris().overlay;
}

export function useIrisScope(): IrisScopeState {
  return useIris().scope;
}

// ---------------------------------------------------------------------------
// Iris button
// ---------------------------------------------------------------------------

export interface IrisButtonProps {
  irisId: string;
  className?: string;
  style?: CSSProperties;
}

export function IrisButton({
  irisId,
  className,
  style,
}: IrisButtonProps): React.ReactElement {
  const { scope } = useIris();
  const enabled = scope.enabledIds.has(irisId);
  return (
    <button
      type="button"
      aria-label={enabled ? `iris: disable ${irisId}` : `iris: enable ${irisId}`}
      data-iris-button={irisId}
      data-iris-enabled={enabled ? "true" : "false"}
      className={className}
      style={{
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: "2px 4px",
        fontSize: 11,
        fontFamily: "system-ui, sans-serif",
        color: enabled ? "#7c3aed" : "#9ca3af",
        ...style,
      }}
      onClick={() => scope.toggleId(irisId)}
    >
      iris {enabled ? "●" : "○"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

const IRIS_PURPLE = "#7c3aed";
const IRIS_PURPLE_GLOW = "rgba(124, 58, 237, 0.22)";

function ringStyle(highlight: IrisHighlight): CSSProperties {
  const { phase, role } = highlight;
  const isDashed = role === "target";
  const opacity = phase === "intent" ? 0.55 : phase === "done" ? 0.3 : 1;
  const animation =
    phase === "active"
      ? "iris-pulse 1.1s ease-in-out infinite"
      : undefined;

  return {
    position: "fixed",
    pointerEvents: "none",
    border: `2px ${isDashed ? "dashed" : "solid"} ${IRIS_PURPLE}`,
    boxShadow: phase === "active" ? `0 0 0 4px ${IRIS_PURPLE_GLOW}` : undefined,
    borderRadius: 8,
    opacity,
    animation,
    zIndex: 2147483647,
    transition: "opacity 0.2s ease",
  };
}

function IrisSingleRing({ highlight }: { highlight: IrisHighlight }): React.ReactElement | null {
  const target =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>(`[data-iris-id="${cssEscape(highlight.id)}"]`);
  if (!target) return null;
  const rect = target.getBoundingClientRect();

  return (
    <div
      aria-hidden="true"
      data-iris-overlay={highlight.id}
      data-iris-phase={highlight.phase}
      data-iris-role={highlight.role ?? "default"}
      style={{
        ...ringStyle(highlight),
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}

export function IrisOverlay({
  highlights,
  progressTick: _progressTick,
}: {
  highlights: readonly IrisHighlight[];
  progressTick?: number;
}): React.ReactElement | null {
  if (highlights.length === 0) return null;
  return (
    <>
      <style>{`@keyframes iris-pulse{0%,100%{box-shadow:0 0 0 2px ${IRIS_PURPLE_GLOW}}50%{box-shadow:0 0 0 6px ${IRIS_PURPLE_GLOW}}}`}</style>
      {highlights.map((h) => (
        <IrisSingleRing key={`${h.id}-${h.phase}`} highlight={h} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Default confirm dialog
// ---------------------------------------------------------------------------

function IrisDefaultConfirmDialog({
  command,
  onConfirm,
  onCancel,
}: IrisConfirmRenderProps): React.ReactElement {
  const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2147483646,
  };
  const dialogStyle: CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    padding: "24px 28px",
    minWidth: 320,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    fontFamily: "system-ui, sans-serif",
  };
  const titleStyle: CSSProperties = { margin: "0 0 8px", fontSize: 16, fontWeight: 600 };
  const bodyStyle: CSSProperties = { margin: "0 0 20px", fontSize: 14, color: "#555" };
  const rowStyle: CSSProperties = { display: "flex", gap: 10, justifyContent: "flex-end" };
  const cancelStyle: CSSProperties = {
    padding: "7px 16px", borderRadius: 6, border: "1px solid #d1d5db",
    background: "#fff", cursor: "pointer", fontSize: 14,
  };
  const confirmStyle: CSSProperties = {
    padding: "7px 16px", borderRadius: 6, border: "none",
    background: "#7c3aed", color: "#fff", cursor: "pointer", fontSize: 14,
  };

  return (
    <div data-iris-confirm-backdrop style={backdropStyle}>
      <div role="dialog" aria-modal="true" data-iris-confirm-dialog style={dialogStyle}>
        <p style={titleStyle}>Confirm action</p>
        <p style={bodyStyle}>
          Allow iris agent to run <code>{command}</code>?
        </p>
        <div style={rowStyle}>
          <button type="button" style={cancelStyle} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" style={confirmStyle} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commit history
// ---------------------------------------------------------------------------

export interface IrisCommitHistoryProps {
  /** Maximum number of commits to display (most recent first). Default 20. */
  maxItems?: number;
}

/**
 * Renders a compact list of agent commits with per-commit revert buttons.
 * Must be used inside an IrisProvider.
 */
export function IrisCommitHistory({
  maxItems = 20,
}: IrisCommitHistoryProps): React.ReactElement {
  const { app } = useIris();
  const [commits, setCommits] = useState<IrisCommit[]>(() => app.getCommits());

  const refresh = useCallback(() => setCommits(app.getCommits()), [app]);

  const handleRevert = useCallback(
    async (commitId: string) => {
      await app.revertCommit(commitId);
      refresh();
    },
    [app, refresh],
  );

  const visible = commits.slice(-maxItems).reverse();

  const containerStyle: CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    fontSize: 13,
    lineHeight: 1.5,
  };
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 0",
    borderBottom: "1px solid #f0f0f0",
  };
  const actorStyle = (actor: IrisCommit["actor"]): CSSProperties => ({
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 11,
    background: actor === "agent" ? "#ede9fe" : "#f3f4f6",
    color: actor === "agent" ? "#6d28d9" : "#374151",
  });
  const statusStyle = (status: IrisCommit["status"]): CSSProperties => ({
    color: status === "active" ? "#16a34a" : "#9ca3af",
    fontSize: 11,
  });
  const revertBtnStyle: CSSProperties = {
    marginLeft: "auto",
    padding: "2px 10px",
    borderRadius: 4,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
  };

  if (visible.length === 0) {
    return (
      <div data-iris-commit-history style={{ ...containerStyle, color: "#9ca3af" }}>
        No commits yet.
      </div>
    );
  }

  return (
    <div data-iris-commit-history style={containerStyle}>
      {visible.map((commit) => (
        <div key={commit.commitId} data-iris-commit={commit.commitId} style={rowStyle}>
          <code style={{ flex: "0 0 auto" }}>{commit.command}</code>
          <span style={actorStyle(commit.actor)}>{commit.actor}</span>
          <span style={statusStyle(commit.status)}>{commit.status}</span>
          {commit.revertable && commit.status === "active" && (
            <button
              type="button"
              style={revertBtnStyle}
              onClick={() => void handleRevert(commit.commitId)}
            >
              Revert
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

export function collectIrisSnapshot(root: ParentNode = document.body): IrisDomSnapshot {
  const nodes: IrisSnapshotNode[] = [];
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-iris-id]"));

  for (const element of elements) {
    if (element.closest("[data-iris-blind]")) continue;
    const id = element.dataset.irisId;
    if (!id) continue;
    const rect = element.getBoundingClientRect();
    nodes.push({
      id,
      text: readElementText(element),
      role: element.getAttribute("role"),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  }

  return { nodes };
}

function readElementText(element: HTMLElement): string {
  const ownRedaction = element.dataset.irisRedact;
  if (ownRedaction) return `[REDACTED_${ownRedaction.toUpperCase()}]`;

  const clone = element.cloneNode(true) as HTMLElement;
  for (const blind of Array.from(clone.querySelectorAll("[data-iris-blind]"))) {
    blind.remove();
  }
  for (const redacted of Array.from(
    clone.querySelectorAll<HTMLElement>("[data-iris-redact]"),
  )) {
    const type = redacted.dataset.irisRedact ?? "VALUE";
    redacted.textContent = `[REDACTED_${type.toUpperCase()}]`;
  }
  return (clone.textContent ?? "").trim();
}

function cssEscape(value: string): string {
  const globalEscape = (
    globalThis as unknown as { CSS?: { escape?: (value: string) => string } }
  ).CSS?.escape;
  if (globalEscape) return globalEscape(value);
  return value.replace(/["\\]/g, "\\$&");
}

