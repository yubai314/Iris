export type IrisPlatform = "tauri" | "electron" | "server";

export type IrisCommandKind = "readable" | "writable";

export type IrisCommandLayer = "core" | "contextual" | "discoverable" | "hidden";

export type IrisRisk =
  | "low"
  | "medium"
  | "reversible"
  | "compensatable"
  | "destructive"
  | "irreversible";

export type IrisConfirm = "required" | "optional" | "never";

export type IrisActor = "user" | "agent" | "system";

export type IrisCommitStatus = "active" | "reverted" | "revert";

export type IrisErrorCode =
  | "PERMISSION_DENIED"
  | "STATE_CONFLICT"
  | "SCHEMA_INVALID"
  | "USER_CONFIRM_REQUIRED"
  | "APP_BUSY"
  | "REDACTED_FIELD"
  | "RATE_LIMITED"
  | "UNSUPPORTED_COMMAND"
  | "MODEL_OUTPUT_INVALID";

export interface IrisError {
  code: IrisErrorCode;
  message?: string;
  details?: unknown;
}

export type IrisResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: IrisError };

export interface IrisAction {
  command: string;
  args?: unknown;
}

export interface IrisEvent {
  name: string;
  kind: "domainState" | "uiState";
  payload?: unknown;
  timestamp: string;
}

export interface IrisManifestCommand {
  name: string;
  invoke: string;
  kind: IrisCommandKind;
  layer?: IrisCommandLayer;
  description?: string;
  resource?: string;
  risk?: IrisRisk;
  revertable: boolean;
  confirm?: IrisConfirm;
  argsSchema?: unknown;
  commandVersion?: string;
}

export interface IrisManifest {
  irisProtocolVersion: string;
  appSchemaVersion?: string;
  platform: IrisPlatform;
  commands: IrisManifestCommand[];
}

export interface IrisRateLimitRule {
  max: number;
  windowMs: number;
}

export interface IrisRedactionRule {
  field: string;
  replacement?: string;
}

export interface IrisPolicy {
  bannedCommands?: string[];
  confirmCommands?: string[];
  rateLimits?: Record<string, IrisRateLimitRule>;
  redactions?: IrisRedactionRule[];
}

export interface IrisCommit {
  commitId: string;
  command: string;
  args: unknown;
  before: unknown;
  after: unknown;
  revertable: boolean;
  inverse?: IrisAction;
  actor: IrisActor;
  timestamp: string;
  status: IrisCommitStatus;
  linkedCommitId?: string;
  idempotencyKey?: string;
}

export interface IrisScopeToken {
  sessionId: string;
  enabledIds: string[];
  issuedAt: string;
}

export interface IrisWorld {
  manifest: IrisManifest;
  readable: Record<string, unknown>;
  snapshot?: unknown;
}

export interface IrisPlatformAdapter {
  platform: IrisPlatform;
  invoke(command: string, args: unknown): Promise<unknown>;
  subscribe?(
    event: string,
    handler: (payload: unknown) => void,
  ): () => void;
}
