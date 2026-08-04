import { metadataStorageKey } from "./storage-keys.ts";
import {
  createLogMetadata,
  parseLogMetadata,
  type LogMetadata,
} from "./session-metadata.ts";

export function loadLogMetadata(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
): LogMetadata | null {
  return parseLogMetadata(
    extension.storageGet(metadataStorageKey(groupId, logName)),
  );
}

export function loadOrCreateLogMetadata(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
  now: number,
): LogMetadata {
  return loadLogMetadata(extension, groupId, logName) ?? createLogMetadata(now);
}

export function saveLogMetadata(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
  metadata: LogMetadata,
): void {
  extension.storageSet(
    metadataStorageKey(groupId, logName),
    JSON.stringify(metadata),
  );
}
