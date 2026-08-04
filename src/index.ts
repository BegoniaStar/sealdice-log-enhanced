import {
  detectLogTransition,
  readNativeLogState,
  type NativeLogState,
} from "./log-lifecycle.ts";
import { replyToLocator, saveLocator } from "./locator.ts";
import { registerLogMarkCommand } from "./logmark.ts";
import { parseLogCommand } from "./log-command.ts";
import { registerLogTimeCommand } from "./logtime.ts";
import { MessageRenderer, registerMessageTemplateConfigs } from "./messages.ts";
import { registerSettings } from "./settings.ts";
import {
  startLogTimer,
  stopLogTimer,
  type LogTimerStartResult,
  type LogTimerStopResult,
} from "./timer.ts";
import {
  formatDateTime,
  formatDuration,
  formatRelativeTime,
} from "./timer-state.ts";

const extensionName = "sealdice-log-enhanced";
const existing = seal.ext.find(extensionName);
const extension =
  existing ??
  seal.ext.new(
    extensionName,
    "檀轶步棋、JustAnotherID、BegoniaHe、星·麒",
    "1.2.1",
  );

if (existing === null) seal.ext.register(extension);

extension.autoActive = true;
registerMessageTemplateConfigs(extension);
registerSettings(extension);
const messages = new MessageRenderer(extension);

type PendingLogState = {
  readonly expiresAt: number;
  readonly state: NativeLogState;
};

const pendingLogStates = new Map<string, PendingLogState>();
const pendingStateLifetime = 60_000;
const pendingStateMaximum = 128;

function messageKey(msg: seal.Message): string | null {
  if (typeof msg.rawId !== "string" && typeof msg.rawId !== "number")
    return null;
  const rawId = String(msg.rawId).trim();
  if (rawId === "") return null;
  return `${msg.groupId}:${rawId}`;
}

function discardExpiredSnapshots(now: number): void {
  for (const [key, pending] of pendingLogStates)
    if (pending.expiresAt <= now) pendingLogStates.delete(key);
  while (pendingLogStates.size >= pendingStateMaximum) {
    const oldest = pendingLogStates.keys().next().value;
    if (oldest === undefined) return;
    pendingLogStates.delete(oldest);
  }
}

extension.onMessageReceived = (ctx, msg): void => {
  if (ctx.isPrivate || msg.messageType !== "group") return;
  const key = messageKey(msg);
  if (key === null) return;
  const now = Date.now();
  discardExpiredSnapshots(now);
  pendingLogStates.set(key, {
    expiresAt: now + pendingStateLifetime,
    state: readNativeLogState(ctx),
  });
};

function takeSnapshot(msg: seal.Message): NativeLogState | null {
  const key = messageKey(msg);
  if (key === null) return null;
  const pending = pendingLogStates.get(key);
  pendingLogStates.delete(key);
  if (pending === undefined || pending.expiresAt <= Date.now()) return null;
  return pending.state;
}

function renderTimerStart(
  ctx: seal.MsgContext,
  logName: string,
  result: LogTimerStartResult,
  now: number,
): string {
  if (result.kind === "started")
    return messages.render(ctx, "timerStarted", {
      logName,
      timestamp: formatDateTime(now),
    });
  if (result.kind === "resumed")
    return messages.render(ctx, "timerResumed", {
      logName,
      timestamp: formatDateTime(now),
      totalDuration: formatDuration(result.previousTotalTime),
      previousEndRelative: formatRelativeTime(result.previousEndTime, now),
      previousEndTime: formatDateTime(result.previousEndTime),
    });
  return messages.render(
    ctx,
    result.kind === "recovered-missing"
      ? "timerRecoveredMissingStarted"
      : "timerRecoveredActiveStarted",
    {
      logName,
      totalDuration: formatDuration(result.state.totalTime),
    },
  );
}

function renderTimerStop(
  ctx: seal.MsgContext,
  logName: string,
  result: LogTimerStopResult,
): string | null {
  if (result.kind === "unchanged") return null;
  if (result.kind === "stopped")
    return messages.render(ctx, "timerStopped", {
      logName,
      timestamp: formatDateTime(result.state.lastEndTime),
      currentDuration: formatDuration(result.currentTime),
      totalDuration: formatDuration(result.state.totalTime),
    });
  return messages.render(
    ctx,
    result.kind === "recovered-missing"
      ? "timerRecoveredMissingStopped"
      : "timerRecoveredPausedStopped",
    {
      logName,
      totalDuration: formatDuration(result.state.totalTime),
    },
  );
}

registerLogTimeCommand(extension, messages);
registerLogMarkCommand(extension, messages);

extension.onCommandReceived = (ctx, msg, cmdArgs): void => {
  if (cmdArgs.command !== "log" || ctx.isPrivate || msg.messageType !== "group")
    return;

  const parsed = parseLogCommand(cmdArgs);
  if (parsed === null) return;
  const before = takeSnapshot(msg);
  if (before === null) return;
  const transition = detectLogTransition(
    parsed.action,
    before,
    readNativeLogState(ctx),
  );
  if (transition.kind === "none") return;

  if (transition.kind === "started") {
    if (parsed.action === "on") replyToLocator(extension, messages, ctx, msg);
    const now = Date.now();
    const result = startLogTimer(
      extension,
      msg.groupId,
      transition.logName,
      now,
      parsed.action === "on" ? "on" : "new",
    );
    seal.replyToSender(
      ctx,
      msg,
      renderTimerStart(ctx, transition.logName, result, now),
    );
    return;
  }

  if (transition.kind === "replaced") {
    const now = Date.now();
    stopLogTimer(extension, msg.groupId, transition.previousLogName, now, true);
    const result = startLogTimer(
      extension,
      msg.groupId,
      transition.logName,
      now,
      "new",
    );
    seal.replyToSender(
      ctx,
      msg,
      renderTimerStart(ctx, transition.logName, result, now),
    );
    return;
  }

  saveLocator(extension, msg.groupId, msg.rawId);
  const result = stopLogTimer(
    extension,
    msg.groupId,
    transition.logName,
    Date.now(),
    before.isOn,
  );
  const text = renderTimerStop(ctx, transition.logName, result);
  if (text !== null) seal.replyToSender(ctx, msg, text);
};
