function encodePart(value: string): string {
  return encodeURIComponent(value);
}

export function locatorStorageKey(groupId: string): string {
  return `locator:${encodePart(groupId)}`;
}

export function timerStorageKey(groupId: string, logName: string): string {
  return `timer:${encodePart(groupId)}:${encodePart(logName)}`;
}

export function activeTimerStorageKey(groupId: string): string {
  return `timer-active:${encodePart(groupId)}`;
}

export function metadataStorageKey(groupId: string, logName: string): string {
  return `metadata:${encodePart(groupId)}:${encodePart(logName)}`;
}
