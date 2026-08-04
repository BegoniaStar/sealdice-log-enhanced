import {
  loadLogMetadata,
  loadOrCreateLogMetadata,
  saveLogMetadata,
} from "./session-store.ts";
import {
  closeOpenSegment,
  discardOpenSegment,
  markSynchronized,
  recordSegmentEnd,
  recordSegmentStart,
  restartOpenSegment,
} from "./session-metadata.ts";
import { segmentLimit } from "./settings.ts";
import { activeTimerStorageKey, timerStorageKey } from "./storage-keys.ts";
import {
  createPausedTimer,
  parseTimerState,
  restartActiveTimer,
  startTimer,
  stopTimer,
  type TimerState,
} from "./timer-state.ts";

export type TimerStartIntent = "new" | "on";

export type LogTimerStartResult = {
  readonly kind:
    "started" | "resumed" | "recovered-missing" | "recovered-active";
  readonly previousEndTime: number;
  readonly previousTotalTime: number;
  readonly state: TimerState;
};

export type LogTimerStopResult =
  | {
      readonly kind: "stopped";
      readonly currentTime: number;
      readonly state: TimerState;
    }
  | { readonly kind: "recovered-missing"; readonly state: TimerState }
  | { readonly kind: "recovered-paused"; readonly state: TimerState }
  | { readonly kind: "unchanged"; readonly state: TimerState | null };

export function loadTimer(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
): TimerState | null {
  return parseTimerState(
    extension.storageGet(timerStorageKey(groupId, logName)),
  );
}

function saveTimer(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
  state: TimerState,
): void {
  extension.storageSet(
    timerStorageKey(groupId, logName),
    JSON.stringify(state),
  );
}

export function currentLogName(
  extension: seal.ExtInfo,
  groupId: string,
): string {
  return extension.storageGet(activeTimerStorageKey(groupId));
}

function persistStartedSession(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
  state: TimerState,
  metadata: ReturnType<typeof loadOrCreateLogMetadata>,
): void {
  saveTimer(extension, groupId, logName, state);
  saveLogMetadata(extension, groupId, logName, metadata);
  extension.storageSet(activeTimerStorageKey(groupId), logName);
}

/**
 * Starts a plugin-side timer after a confirmed native start. Any active timer
 * already stored for this log is stale because native state was inactive before
 * the command; its unverified interval is deliberately discarded.
 */
export function startLogTimer(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
  now: number,
  intent: TimerStartIntent,
): LogTimerStartResult {
  const previous = loadTimer(extension, groupId, logName);
  const limit = segmentLimit(extension);
  const baseMetadata = loadOrCreateLogMetadata(
    extension,
    groupId,
    logName,
    now,
  );

  if (previous === null) {
    const started = startTimer(null, now);
    if (started.kind !== "started") throw new Error("new timer must start");
    const latestSegment =
      baseMetadata.segments[baseMetadata.segments.length - 1];
    const recovered =
      intent === "on" ||
      (latestSegment !== undefined && latestSegment.endedAt === null);
    const metadata = markSynchronized(
      recovered
        ? restartOpenSegment(baseMetadata, now, limit)
        : recordSegmentStart(baseMetadata, now, limit),
      recovered ? "recovered-missing-start" : "normal",
      now,
    );
    persistStartedSession(extension, groupId, logName, started.state, metadata);
    return {
      kind: recovered ? "recovered-missing" : "started",
      previousEndTime: now,
      previousTotalTime: 0,
      state: started.state,
    };
  }

  if (previous.begin) {
    const state = restartActiveTimer(previous, now);
    const metadata = markSynchronized(
      restartOpenSegment(baseMetadata, now, limit),
      "recovered-active-start",
      now,
    );
    persistStartedSession(extension, groupId, logName, state, metadata);
    return {
      kind: "recovered-active",
      previousEndTime: previous.lastEndTime,
      previousTotalTime: previous.totalTime,
      state,
    };
  }

  const started = startTimer(previous, now);
  if (started.kind !== "started") throw new Error("paused timer must start");
  const metadata = markSynchronized(
    recordSegmentStart(baseMetadata, now, limit),
    "normal",
    now,
  );
  persistStartedSession(extension, groupId, logName, started.state, metadata);
  return {
    kind: "resumed",
    previousEndTime: started.previousEndTime,
    previousTotalTime: started.previousTotalTime,
    state: started.state,
  };
}

/**
 * Stops a plugin-side timer after a confirmed native stop. When native state
 * had been active, missing or already-paused plugin state is repaired without
 * adding any duration that cannot be verified.
 */
export function stopLogTimer(
  extension: seal.ExtInfo,
  groupId: string,
  logName: string,
  now: number,
  expectedActive: boolean,
): LogTimerStopResult {
  const previous = loadTimer(extension, groupId, logName);
  const limit = segmentLimit(extension);

  if (previous === null) {
    if (!expectedActive) return { kind: "unchanged", state: null };
    const state = createPausedTimer(now);
    const metadata = markSynchronized(
      discardOpenSegment(
        loadOrCreateLogMetadata(extension, groupId, logName, now),
      ),
      "recovered-missing-stop",
      now,
    );
    saveTimer(extension, groupId, logName, state);
    saveLogMetadata(extension, groupId, logName, metadata);
    return { kind: "recovered-missing", state };
  }

  const stopped = stopTimer(previous, now);
  if (stopped.kind === "stopped") {
    const metadata = markSynchronized(
      recordSegmentEnd(
        loadOrCreateLogMetadata(extension, groupId, logName, now),
        previous.lastBeginTime,
        now,
        limit,
      ),
      "normal",
      now,
    );
    saveTimer(extension, groupId, logName, stopped.state);
    saveLogMetadata(extension, groupId, logName, metadata);
    return {
      kind: "stopped",
      currentTime: stopped.currentTime,
      state: stopped.state,
    };
  }

  const metadata =
    expectedActive || loadLogMetadata(extension, groupId, logName) !== null
      ? loadOrCreateLogMetadata(extension, groupId, logName, now)
      : null;
  if (metadata !== null) {
    const reconciled = closeOpenSegment(metadata, previous.lastEndTime, limit);
    saveLogMetadata(
      extension,
      groupId,
      logName,
      expectedActive
        ? markSynchronized(reconciled, "recovered-paused-stop", now)
        : reconciled,
    );
  }
  if (!expectedActive) return { kind: "unchanged", state: previous };
  return { kind: "recovered-paused", state: previous };
}
