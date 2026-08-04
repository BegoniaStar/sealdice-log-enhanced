import type { MessageRenderer } from "./messages.ts";
import { loadLogMetadata } from "./session-store.ts";
import type { SynchronizationStatus } from "./session-metadata.ts";
import { currentLogName, loadTimer } from "./timer.ts";
import {
  formatDateTime,
  formatDuration,
  totalDurationAt,
  type TimerState,
} from "./timer-state.ts";

function reply(
  ctx: seal.MsgContext,
  msg: seal.Message,
  text: string,
): seal.CmdExecuteResult {
  seal.replyToSender(ctx, msg, text);
  return seal.ext.newCmdExecuteResult(true);
}

function selectedLogName(
  extension: seal.ExtInfo,
  ctx: seal.MsgContext,
  requestedName: string,
): string {
  if (requestedName !== "") return requestedName;
  const group = ctx.group;
  if (group !== null && group.logCurName !== "") return group.logCurName;
  return currentLogName(extension, group?.groupId ?? "");
}

function timerStatus(timer: TimerState | null, now: number): string {
  if (timer === null) return "未建立计时";
  if (!timer.begin)
    return timer.lastEndTime === 0
      ? "已暂停"
      : `已暂停，上次停止于${formatDateTime(timer.lastEndTime)}`;
  return `计时中，本次已进行${formatDuration(now - timer.lastBeginTime)}`;
}

function synchronizationStatus(
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  status: SynchronizationStatus | null,
): string {
  if (status === null) return messages.render(ctx, "syncNotRecorded");
  if (status.kind === "normal") return messages.render(ctx, "syncNormal");
  const templateKeys = {
    "recovered-missing-start": "syncRecoveredMissingStart",
    "recovered-active-start": "syncRecoveredActiveStart",
    "recovered-missing-stop": "syncRecoveredMissingStop",
    "recovered-paused-stop": "syncRecoveredPausedStop",
  } as const;
  return messages.render(ctx, templateKeys[status.kind], {
    timestamp: formatDateTime(status.at),
  });
}

function formatHistory(
  segments: readonly { startedAt: number; endedAt: number | null }[],
  now: number,
): string {
  if (segments.length === 0) return "尚无分段记录。";
  return segments
    .map((segment, index) => {
      const end = segment.endedAt;
      const duration = Math.max(0, (end ?? now) - segment.startedAt);
      const finish = end === null ? "进行中" : formatDateTime(end);
      return `${index + 1}. ${formatDateTime(segment.startedAt)} 至 ${finish}（${formatDuration(duration)}）`;
    })
    .join("\n");
}

function formatBookmarks(
  bookmarks: readonly { createdAt: number; label: string }[],
): string {
  if (bookmarks.length === 0) return "暂无书签。";
  return bookmarks
    .map(
      (bookmark, index) =>
        `#${index + 1} ${formatDateTime(bookmark.createdAt)} ${bookmark.label}`,
    )
    .join("\n");
}

function resolveData(
  extension: seal.ExtInfo,
  ctx: seal.MsgContext,
  requestedName: string,
): {
  logName: string;
  metadata: ReturnType<typeof loadLogMetadata>;
  timer: TimerState | null;
} {
  const groupId = ctx.group?.groupId ?? "";
  const logName = selectedLogName(extension, ctx, requestedName);
  return {
    logName,
    metadata:
      logName === "" ? null : loadLogMetadata(extension, groupId, logName),
    timer: logName === "" ? null : loadTimer(extension, groupId, logName),
  };
}

function handleInfo(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
  requestedName: string,
  now: number,
): seal.CmdExecuteResult {
  const { logName, metadata, timer } = resolveData(
    extension,
    ctx,
    requestedName,
  );
  if (logName === "" || (metadata === null && timer === null))
    return reply(ctx, msg, messages.render(ctx, "timerInfoMissing"));
  const nativeIsOn =
    ctx.group?.logOn === true && ctx.group.logCurName === logName;
  return reply(
    ctx,
    msg,
    messages.render(ctx, "timerInfo", {
      logName,
      nativeStatus: nativeIsOn ? "正在记录" : "未开启",
      timerStatus: timerStatus(timer, now),
      totalDuration:
        timer === null ? "0秒" : formatDuration(totalDurationAt(timer, now)),
      segmentCount: String(metadata?.segments.length ?? 0),
      bookmarkCount: String(metadata?.bookmarks.length ?? 0),
      synchronizationStatus: synchronizationStatus(
        messages,
        ctx,
        metadata?.synchronization ?? null,
      ),
    }),
  );
}

function handleHistory(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
  requestedName: string,
  now: number,
): seal.CmdExecuteResult {
  const { logName, metadata, timer } = resolveData(
    extension,
    ctx,
    requestedName,
  );
  if (logName === "" || (metadata === null && timer === null))
    return reply(ctx, msg, messages.render(ctx, "timerInfoMissing"));
  return reply(
    ctx,
    msg,
    messages.render(ctx, "timerHistory", {
      logName,
      details: formatHistory(metadata?.segments ?? [], now),
    }),
  );
}

function handleRecap(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
  requestedName: string,
  now: number,
): seal.CmdExecuteResult {
  const { logName, metadata, timer } = resolveData(
    extension,
    ctx,
    requestedName,
  );
  if (logName === "" || (metadata === null && timer === null))
    return reply(ctx, msg, messages.render(ctx, "timerInfoMissing"));
  const segments = metadata?.segments ?? [];
  const bookmarks = metadata?.bookmarks ?? [];
  return reply(
    ctx,
    msg,
    messages.render(ctx, "timerRecap", {
      logName,
      totalDuration:
        timer === null ? "0秒" : formatDuration(totalDurationAt(timer, now)),
      segmentCount: String(segments.length),
      bookmarkCount: String(bookmarks.length),
      details: `书签明细：\n${formatBookmarks(bookmarks)}`,
    }),
  );
}

export function registerLogTimeCommand(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
): void {
  const command = seal.ext.newCmdItemInfo();
  command.name = "logtime";
  command.help =
    ".logtime info [日志名] 查看计时信息\n.logtime history [日志名] 查看计时分段\n.logtime recap [日志名] 生成会话摘要";
  command.disabledInPrivate = true;
  command.solve = (ctx, msg, cmdArgs): seal.CmdExecuteResult => {
    if (ctx.group === null || msg.messageType !== "group")
      return reply(ctx, msg, messages.render(ctx, "timerInfoMissing"));
    const action = cmdArgs.getArgN(1).toLowerCase();
    const requestedName = cmdArgs.getArgN(2).trim();
    const now = Date.now();
    if (action === "history")
      return handleHistory(extension, messages, ctx, msg, requestedName, now);
    if (action === "recap")
      return handleRecap(extension, messages, ctx, msg, requestedName, now);
    return handleInfo(extension, messages, ctx, msg, requestedName, now);
  };
  extension.cmdMap.logtime = command;
}
