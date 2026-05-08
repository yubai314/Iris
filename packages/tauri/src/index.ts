import type { IrisPlatformAdapter } from "@iris/protocol";

export interface TauriAdapterOptions {
  invoke?: (command: string, args: unknown) => Promise<unknown>;
  /**
   * Override the event subscription backend. Receives an event name and a
   * handler, must return a Promise that resolves to an unlisten function.
   * Defaults to `@tauri-apps/api/event` listen.
   */
  listen?: (event: string, handler: (payload: unknown) => void) => Promise<() => void>;
}

export function tauriAdapter(options: TauriAdapterOptions = {}): IrisPlatformAdapter {
  return {
    platform: "tauri",

    async invoke(command, args) {
      if (options.invoke) return options.invoke(command, args);
      const tauri = await import("@tauri-apps/api/core");
      return tauri.invoke(command, args as Record<string, unknown>);
    },

    subscribe(event, handler) {
      let unlisten: (() => void) | undefined;
      let cancelled = false;

      const setup = async () => {
        if (options.listen) {
          const fn = await options.listen(event, handler);
          if (cancelled) fn();
          else unlisten = fn;
          return;
        }
        const { listen } = await import("@tauri-apps/api/event");
        const fn = await listen<unknown>(event, (e) => handler(e.payload));
        if (cancelled) fn();
        else unlisten = fn;
      };

      setup().catch(() => {
        // Silently ignore setup errors; the caller controls retry.
      });

      return () => {
        cancelled = true;
        unlisten?.();
      };
    },
  };
}
