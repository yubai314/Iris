import type { IrisPlatformAdapter } from "@iris/protocol";

/**
 * The iris Electron adapter expects the renderer process to have access to a
 * contextBridge-exposed object named `irisElectron`. Wire it up in your
 * preload script:
 *
 * ```ts
 * // preload.ts
 * import { contextBridge, ipcRenderer } from "electron";
 *
 * contextBridge.exposeInMainWorld("irisElectron", {
 *   invoke(channel: string, args: unknown) {
 *     return ipcRenderer.invoke(channel, args);
 *   },
 *   listen(channel: string, handler: (payload: unknown) => void) {
 *     const listener = (_event: unknown, payload: unknown) => handler(payload);
 *     ipcRenderer.on(channel, listener);
 *     return () => ipcRenderer.removeListener(channel, listener);
 *   },
 * });
 * ```
 *
 * In the main process, handle commands via `ipcMain.handle`:
 *
 * ```ts
 * ipcMain.handle("move_item", (_event, args) => moveItem(args));
 * ```
 */

export interface IrisElectronBridge {
  invoke(channel: string, args: unknown): Promise<unknown>;
  listen(channel: string, handler: (payload: unknown) => void): () => void;
}

export interface ElectronAdapterOptions {
  /**
   * Override the bridge entirely, e.g. for testing:
   * ```ts
   * electronAdapter({ bridge: { invoke: mockInvoke, listen: mockListen } })
   * ```
   */
  bridge?: IrisElectronBridge;
}

function getBridge(options: ElectronAdapterOptions): IrisElectronBridge {
  if (options.bridge) return options.bridge;
  const win = globalThis as unknown as { irisElectron?: IrisElectronBridge };
  if (!win.irisElectron) {
    throw new Error(
      "irisElectron contextBridge is not available. " +
        "Expose it in your preload script — see @iris/electron docs.",
    );
  }
  return win.irisElectron;
}

export function electronAdapter(options: ElectronAdapterOptions = {}): IrisPlatformAdapter {
  return {
    platform: "electron",

    async invoke(command, args) {
      return getBridge(options).invoke(command, args);
    },

    subscribe(event, handler) {
      return getBridge(options).listen(event, handler);
    },
  };
}
