import type { LogAction } from "./log-command.ts";

export type NativeLogState = {
  readonly isOn: boolean;
  readonly logName: string;
};

export type LogTransition =
  | { readonly kind: "none" }
  | { readonly kind: "started"; readonly logName: string }
  | {
      readonly kind: "replaced";
      readonly previousLogName: string;
      readonly logName: string;
    }
  | { readonly kind: "stopped"; readonly logName: string };

export function readNativeLogState(ctx: seal.MsgContext): NativeLogState {
  const logName = ctx.group?.logCurName.trim() ?? "";
  return { isOn: ctx.group?.logOn === true && logName !== "", logName };
}

export function detectLogTransition(
  action: LogAction,
  before: NativeLogState,
  after: NativeLogState,
): LogTransition {
  if (action === "new" && before.isOn && after.isOn) {
    if (before.logName !== after.logName) {
      return {
        kind: "replaced",
        previousLogName: before.logName,
        logName: after.logName,
      };
    }
    return { kind: "none" };
  }

  if ((action === "new" || action === "on") && !before.isOn && after.isOn) {
    return { kind: "started", logName: after.logName };
  }

  if (action === "off" && before.isOn && !after.isOn)
    return { kind: "stopped", logName: before.logName };

  if (
    (action === "end" || action === "halt") &&
    before.logName !== "" &&
    after.logName === ""
  ) {
    return { kind: "stopped", logName: before.logName };
  }

  return { kind: "none" };
}
