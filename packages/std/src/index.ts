import { writable, z, type IrisCommand } from "@iris/core";

export type { IrisCommand };

interface BaseOpts {
  invoke: string;
  description?: string;
}

/**
 * Standard semantic operation library.
 *
 * Each factory returns a ready-to-use writable command with correct safety
 * properties pre-declared. Pass it directly into defineIrisApp commands:
 *
 * ```ts
 * commands: {
 *   archiveItem: stdOp.itemArchive({ invoke: "archive_item" }),
 *   moveItem:    stdOp.itemMove({ invoke: "move_item" }),
 *   batchMove:   stdOp.batchMove({ invoke: "batch_move" }),
 * }
 * ```
 */
export const stdOp = {
  // ---------------------------------------------------------------------------
  // Item operations
  // ---------------------------------------------------------------------------

  itemArchive(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Archive an item, removing it from the active view",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ id: z.string() }),
    });
  },

  itemUnarchive(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Restore an archived item to the active view",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ id: z.string() }),
    });
  },

  itemFlag(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Flag an item for attention",
      resource: "item",
      risk: "low",
      revertable: true,
      args: z.object({ id: z.string() }),
    });
  },

  itemUnflag(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Remove the flag from an item",
      resource: "item",
      risk: "low",
      revertable: true,
      args: z.object({ id: z.string() }),
    });
  },

  itemMove(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Move an item to a different collection",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ id: z.string(), targetId: z.string() }),
    });
  },

  itemTag(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Set or replace tags on an item",
      resource: "item",
      risk: "low",
      revertable: true,
      args: z.object({ id: z.string(), tags: z.array(z.string()) }),
    });
  },

  itemDelete(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Permanently delete an item — cannot be undone",
      resource: "item",
      risk: "irreversible",
      revertable: false,
      confirm: "required",
      args: z.object({ id: z.string() }),
    });
  },

  // ---------------------------------------------------------------------------
  // Collection operations
  // ---------------------------------------------------------------------------

  collectionAdd(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Create a new collection",
      resource: "collection",
      risk: "reversible",
      revertable: true,
      args: z.object({ name: z.string() }),
    });
  },

  collectionRename(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Rename an existing collection",
      resource: "collection",
      risk: "low",
      revertable: true,
      args: z.object({ id: z.string(), name: z.string() }),
    });
  },

  collectionRemove(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Remove a collection — requires confirmation",
      resource: "collection",
      risk: "destructive",
      revertable: false,
      confirm: "required",
      args: z.object({ id: z.string() }),
    });
  },

  // ---------------------------------------------------------------------------
  // Batch operations
  // ---------------------------------------------------------------------------

  batchMove(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Move multiple items to a collection in one operation",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ ids: z.array(z.string()), targetId: z.string() }),
    });
  },

  batchArchive(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Archive multiple items at once",
      resource: "item",
      risk: "reversible",
      revertable: true,
      args: z.object({ ids: z.array(z.string()) }),
    });
  },

  batchTag(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Apply tags to multiple items at once",
      resource: "item",
      risk: "low",
      revertable: true,
      args: z.object({ ids: z.array(z.string()), tags: z.array(z.string()) }),
    });
  },

  batchDelete(opts: BaseOpts): IrisCommand {
    return writable({
      invoke: opts.invoke,
      description: opts.description ?? "Permanently delete multiple items — requires confirmation",
      resource: "item",
      risk: "irreversible",
      revertable: false,
      confirm: "required",
      args: z.object({ ids: z.array(z.string()) }),
    });
  },
} as const;
