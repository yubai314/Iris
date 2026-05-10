import type { IrisPlatformAdapter } from "@iris/protocol";

export type ServerHandler = (args: unknown) => unknown | Promise<unknown>;

export interface ServerAdapterOptions {
  /**
   * Map from invoke name to handler function. When Iris calls a command, the
   * corresponding handler is called directly — no IPC, no serialization overhead.
   *
   * ```ts
   * serverAdapter({
   *   handlers: {
   *     get_feed_items: (args) => db.query(args),
   *     move_item:      (args) => db.move(args),
   *   }
   * })
   * ```
   */
  handlers: Record<string, ServerHandler>;
  /**
   * Subscribe to server-side events (e.g. database change streams) and forward
   * them as Iris domain events.
   */
  subscribe?: (event: string, handler: (payload: unknown) => void) => () => void;
}

export function serverAdapter(options: ServerAdapterOptions): IrisPlatformAdapter {
  return {
    platform: "server",

    async invoke(command: string, args: unknown): Promise<unknown> {
      const handler = options.handlers[command];
      if (!handler) {
        throw new Error(`@iris/server: no handler registered for command "${command}"`);
      }
      return handler(args);
    },

    subscribe: options.subscribe,
  };
}
