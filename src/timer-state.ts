export type TimerState = {
  begin: boolean;
  totalTime: number;
  lastBeginTime: number;
  lastEndTime: number;
};

export type StartTimerResult =
  | { kind: "already-running" }
  | {
      kind: "started";
      isNew: boolean;
      state: TimerState;
      previousEndTime: number;
      previousTotalTime: number;
    };

export type StopTimerResult =
  | { kind: "missing" }
  | { kind: "not-running" }
  | { kind: "stopped"; state: TimerState; currentTime: number };

export function createPausedTimer(now: number): TimerState {
  return {
    begin: false,
    totalTime: 0,
    lastBeginTime: now,
    lastEndTime: now,
  };
}

/**
 * Drops an active interval whose duration cannot be proven from native state.
 * The confirmed accumulated total remains intact and a new interval starts now.
 */
export function restartActiveTimer(
  previous: TimerState,
  now: number,
): TimerState {
  return {
    begin: true,
    totalTime: previous.totalTime,
    lastBeginTime: now,
    lastEndTime: previous.lastEndTime,
  };
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseTimerState(value: string): TimerState | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.begin !== "boolean" ||
      !isFiniteTimestamp(record.totalTime) ||
      !isFiniteTimestamp(record.lastBeginTime) ||
      !isFiniteTimestamp(record.lastEndTime)
    ) {
      return null;
    }
    return {
      begin: record.begin,
      totalTime: record.totalTime,
      lastBeginTime: record.lastBeginTime,
      lastEndTime: record.lastEndTime,
    };
  } catch {
    return null;
  }
}

export function startTimer(
  previous: TimerState | null,
  now: number,
): StartTimerResult {
  if (previous?.begin) return { kind: "already-running" };

  const totalTime = previous?.totalTime ?? 0;
  const previousEndTime = previous?.lastEndTime ?? now;
  return {
    kind: "started",
    isNew: previous === null,
    previousEndTime,
    previousTotalTime: totalTime,
    state: {
      begin: true,
      totalTime,
      lastBeginTime: now,
      lastEndTime: previousEndTime,
    },
  };
}

export function stopTimer(
  previous: TimerState | null,
  now: number,
): StopTimerResult {
  if (previous === null) return { kind: "missing" };
  if (!previous.begin) return { kind: "not-running" };

  const currentTime = Math.max(0, now - previous.lastBeginTime);
  return {
    kind: "stopped",
    currentTime,
    state: {
      begin: false,
      totalTime: previous.totalTime + currentTime,
      lastBeginTime: previous.lastBeginTime,
      lastEndTime: now,
    },
  };
}

export function totalDurationAt(state: TimerState, now: number): number {
  if (!state.begin) return state.totalTime;
  return state.totalTime + Math.max(0, now - state.lastBeginTime);
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分钟${seconds}秒`;
  if (minutes > 0) return `${minutes}分钟${seconds}秒`;
  return `${seconds}秒`;
}

export function formatDateTime(milliseconds: number): string {
  const date = new Date(milliseconds);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatRelativeTime(then: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - then) / 1_000));
  if (seconds < 60) return seconds < 10 ? "几秒前" : `${seconds}秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}
