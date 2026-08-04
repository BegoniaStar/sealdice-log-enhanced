import type { MessageRenderer } from "./messages.ts";
import {
  loadLogMetadata,
  loadOrCreateLogMetadata,
  saveLogMetadata,
} from "./session-store.ts";
import { addBookmark } from "./session-metadata.ts";
import { bookmarkLimit } from "./settings.ts";
import { currentLogName } from "./timer.ts";
import { formatDateTime } from "./timer-state.ts";

function reply(
  ctx: seal.MsgContext,
  msg: seal.Message,
  text: string,
): seal.CmdExecuteResult {
  seal.replyToSender(ctx, msg, text);
  return seal.ext.newCmdExecuteResult(true);
}

function normalizeMessageId(rawId: unknown): string | null {
  if (typeof rawId !== "string" && typeof rawId !== "number") return null;
  const messageId = String(rawId).trim();
  return messageId === "" ? null : messageId;
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

function formatBookmarks(
  bookmarks: readonly { createdAt: number; label: string }[],
): string {
  return bookmarks
    .map(
      (bookmark, index) =>
        `#${index + 1} ${formatDateTime(bookmark.createdAt)} ${bookmark.label}`,
    )
    .join("\n");
}

function listBookmarks(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
  requestedName: string,
): seal.CmdExecuteResult {
  const groupId = ctx.group?.groupId ?? "";
  const logName = selectedLogName(extension, ctx, requestedName);
  const metadata =
    logName === "" ? null : loadLogMetadata(extension, groupId, logName);
  if (metadata === null || metadata.bookmarks.length === 0)
    return reply(
      ctx,
      msg,
      messages.render(ctx, "markEmpty", { logName: logName || "当前记录" }),
    );
  return reply(
    ctx,
    msg,
    messages.render(ctx, "markList", {
      logName,
      details: formatBookmarks(metadata.bookmarks),
    }),
  );
}

function showBookmark(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
  indexText: string,
  requestedName: string,
): seal.CmdExecuteResult {
  const index = Number(indexText);
  const groupId = ctx.group?.groupId ?? "";
  const logName = selectedLogName(extension, ctx, requestedName);
  const metadata =
    logName === "" ? null : loadLogMetadata(extension, groupId, logName);
  const bookmark =
    Number.isInteger(index) && index > 0
      ? metadata?.bookmarks[index - 1]
      : undefined;
  if (bookmark === undefined)
    return reply(ctx, msg, messages.render(ctx, "markOutOfRange"));
  if (bookmark.messageId === null || !msg.groupId.startsWith("QQ-Group:"))
    return reply(ctx, msg, messages.render(ctx, "markReferenceUnavailable"));
  return reply(
    ctx,
    msg,
    `[CQ:reply,id=${bookmark.messageId}] ${messages.render(
      ctx,
      "markReference",
      {
        markNumber: String(index),
        markLabel: bookmark.label,
      },
    )}`,
  );
}

function addMark(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
  label: string,
  now: number,
): seal.CmdExecuteResult {
  if (ctx.group?.logOn !== true || ctx.group.logCurName === "")
    return reply(ctx, msg, messages.render(ctx, "markNoActiveLog"));
  const logName = ctx.group.logCurName;
  const trimmed = label.trim().slice(0, 120);
  if (trimmed === "")
    return reply(ctx, msg, messages.render(ctx, "markLabelRequired"));
  const metadata = addBookmark(
    loadOrCreateLogMetadata(extension, msg.groupId, logName, now),
    {
      createdAt: now,
      label: trimmed,
      messageId: normalizeMessageId(msg.rawId),
    },
    bookmarkLimit(extension),
  );
  saveLogMetadata(extension, msg.groupId, logName, metadata);
  return reply(
    ctx,
    msg,
    messages.render(ctx, "markAdded", {
      logName,
      markNumber: String(metadata.bookmarks.length),
      markLabel: trimmed,
    }),
  );
}

export function registerLogMarkCommand(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
): void {
  const command = seal.ext.newCmdItemInfo();
  command.name = "logmark";
  command.help =
    ".logmark <标签> 为当前日志添加书签\n.logmark list [日志名] 查看书签\n.logmark show <序号> [日志名] 在 QQ 中引用书签消息";
  command.disabledInPrivate = true;
  command.solve = (ctx, msg, cmdArgs): seal.CmdExecuteResult => {
    if (ctx.group === null || msg.messageType !== "group")
      return reply(ctx, msg, messages.render(ctx, "markNoActiveLog"));
    const first = cmdArgs.getArgN(1).toLowerCase();
    if (first === "list")
      return listBookmarks(
        extension,
        messages,
        ctx,
        msg,
        cmdArgs.getArgN(2).trim(),
      );
    if (first === "show")
      return showBookmark(
        extension,
        messages,
        ctx,
        msg,
        cmdArgs.getArgN(2),
        cmdArgs.getArgN(3).trim(),
      );
    return addMark(
      extension,
      messages,
      ctx,
      msg,
      cmdArgs.getRestArgsFrom(1),
      Date.now(),
    );
  };
  extension.cmdMap.logmark = command;
}
