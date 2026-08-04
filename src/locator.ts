import type { MessageRenderer } from "./messages.ts";
import { locatorStorageKey } from "./storage-keys.ts";

function readMessageId(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "string" && typeof parsed !== "number") return null;
    const messageId = String(parsed).trim();
    return messageId === "" ? null : messageId;
  } catch {
    return null;
  }
}

export function saveLocator(
  extension: seal.ExtInfo,
  groupId: string,
  rawId: unknown,
): void {
  if (typeof rawId !== "string" && typeof rawId !== "number") return;
  const messageId = String(rawId).trim();
  if (messageId === "") return;
  extension.storageSet(locatorStorageKey(groupId), JSON.stringify(messageId));
}

export function replyToLocator(
  extension: seal.ExtInfo,
  messages: MessageRenderer,
  ctx: seal.MsgContext,
  msg: seal.Message,
): void {
  const messageId = readMessageId(
    extension.storageGet(locatorStorageKey(msg.groupId)),
  );
  if (messageId === null) return;
  const text = messages.render(ctx, "locatorReply");
  seal.replyToSender(ctx, msg, `[CQ:reply,id=${messageId}] ${text}`);
}
