export type TimerSegment = {
  readonly startedAt: number;
  readonly endedAt: number | null;
};

export type LogBookmark = {
  readonly createdAt: number;
  readonly label: string;
  readonly messageId: string | null;
};

export type SynchronizationKind =
  | "normal"
  | "recovered-missing-start"
  | "recovered-active-start"
  | "recovered-missing-stop"
  | "recovered-paused-stop";

export type SynchronizationStatus = {
  readonly at: number;
  readonly kind: SynchronizationKind;
};

export type LogMetadata = {
  readonly id: string;
  readonly createdAt: number;
  readonly segments: readonly TimerSegment[];
  readonly bookmarks: readonly LogBookmark[];
  readonly synchronization: SynchronizationStatus | null;
};

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseSegment(value: unknown): TimerSegment | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (!isTimestamp(record.startedAt)) return null;
  if (record.endedAt !== null && !isTimestamp(record.endedAt)) return null;
  if (typeof record.endedAt === "number" && record.endedAt < record.startedAt) {
    return null;
  }
  return { startedAt: record.startedAt, endedAt: record.endedAt ?? null };
}

function parseBookmark(value: unknown): LogBookmark | null {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (
    !isTimestamp(record.createdAt) ||
    typeof record.label !== "string" ||
    record.label.trim() === ""
  ) {
    return null;
  }
  if (record.messageId !== null && typeof record.messageId !== "string")
    return null;
  return {
    createdAt: record.createdAt,
    label: record.label,
    messageId: record.messageId ?? null,
  };
}

const synchronizationKinds: readonly SynchronizationKind[] = [
  "normal",
  "recovered-missing-start",
  "recovered-active-start",
  "recovered-missing-stop",
  "recovered-paused-stop",
];

function parseSynchronization(value: unknown): SynchronizationStatus | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    !isTimestamp(record.at) ||
    typeof record.kind !== "string" ||
    synchronizationKinds.indexOf(record.kind as SynchronizationKind) === -1
  ) {
    return null;
  }
  return { at: record.at, kind: record.kind as SynchronizationKind };
}

export function parseLogMetadata(value: string): LogMetadata | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      record.id.trim() === "" ||
      !isTimestamp(record.createdAt) ||
      !Array.isArray(record.segments) ||
      !Array.isArray(record.bookmarks)
    ) {
      return null;
    }
    const segments = record.segments
      .map(parseSegment)
      .filter((segment): segment is TimerSegment => segment !== null);
    const bookmarks = record.bookmarks
      .map(parseBookmark)
      .filter((bookmark): bookmark is LogBookmark => bookmark !== null);
    return {
      id: record.id,
      createdAt: record.createdAt,
      segments,
      bookmarks,
      synchronization: parseSynchronization(record.synchronization),
    };
  } catch {
    return null;
  }
}

export function createLogMetadata(
  now: number,
  random: () => number = Math.random,
): LogMetadata {
  const suffix = Math.floor(random() * 0x100000000)
    .toString(36)
    .padStart(7, "0");
  return {
    id: `log-${Math.floor(now).toString(36)}-${suffix}`,
    createdAt: now,
    segments: [],
    bookmarks: [],
    synchronization: null,
  };
}

function limitEntries<T>(entries: readonly T[], maximum: number): readonly T[] {
  return entries.slice(-Math.max(1, maximum));
}

export function recordSegmentStart(
  metadata: LogMetadata,
  startedAt: number,
  maximumSegments: number,
): LogMetadata {
  const last = metadata.segments[metadata.segments.length - 1];
  if (last !== undefined && last.endedAt === null) return metadata;
  return {
    ...metadata,
    segments: limitEntries(
      [...metadata.segments, { startedAt, endedAt: null }],
      maximumSegments,
    ),
  };
}

export function recordSegmentEnd(
  metadata: LogMetadata,
  startedAt: number,
  endedAt: number,
  maximumSegments: number,
): LogMetadata {
  const latest = metadata.segments[metadata.segments.length - 1];
  if (latest !== undefined && latest.endedAt === null) {
    return {
      ...metadata,
      segments: limitEntries(
        [
          ...metadata.segments.slice(0, -1),
          {
            startedAt: latest.startedAt,
            endedAt: Math.max(latest.startedAt, endedAt),
          },
        ],
        maximumSegments,
      ),
    };
  }
  return {
    ...metadata,
    segments: limitEntries(
      [
        ...metadata.segments,
        { startedAt, endedAt: Math.max(startedAt, endedAt) },
      ],
      maximumSegments,
    ),
  };
}

/** Closes only an existing open segment, without inventing a new one. */
export function closeOpenSegment(
  metadata: LogMetadata,
  endedAt: number,
  maximumSegments: number,
): LogMetadata {
  const latest = metadata.segments[metadata.segments.length - 1];
  if (latest === undefined || latest.endedAt !== null) return metadata;
  return {
    ...metadata,
    segments: limitEntries(
      [
        ...metadata.segments.slice(0, -1),
        {
          startedAt: latest.startedAt,
          endedAt: Math.max(latest.startedAt, endedAt),
        },
      ],
      maximumSegments,
    ),
  };
}

/** Removes an untrustworthy open segment before starting a recovered interval. */
export function restartOpenSegment(
  metadata: LogMetadata,
  startedAt: number,
  maximumSegments: number,
): LogMetadata {
  const latest = metadata.segments[metadata.segments.length - 1];
  const segments =
    latest !== undefined && latest.endedAt === null
      ? metadata.segments.slice(0, -1)
      : metadata.segments;
  return {
    ...metadata,
    segments: limitEntries(
      [...segments, { startedAt, endedAt: null }],
      maximumSegments,
    ),
  };
}

export function discardOpenSegment(metadata: LogMetadata): LogMetadata {
  const latest = metadata.segments[metadata.segments.length - 1];
  if (latest === undefined || latest.endedAt !== null) return metadata;
  return { ...metadata, segments: metadata.segments.slice(0, -1) };
}

export function markSynchronized(
  metadata: LogMetadata,
  kind: SynchronizationKind,
  at: number,
): LogMetadata {
  return { ...metadata, synchronization: { kind, at } };
}

export function addBookmark(
  metadata: LogMetadata,
  bookmark: LogBookmark,
  maximumBookmarks: number,
): LogMetadata {
  return {
    ...metadata,
    bookmarks: limitEntries(
      [...metadata.bookmarks, bookmark],
      maximumBookmarks,
    ),
  };
}
