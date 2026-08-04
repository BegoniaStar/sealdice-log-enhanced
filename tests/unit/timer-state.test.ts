import assert from "node:assert/strict";
import test from "node:test";

import {
  createPausedTimer,
  formatDuration,
  parseTimerState,
  restartActiveTimer,
  startTimer,
  stopTimer,
  totalDurationAt,
} from "../../src/timer-state.ts";

test("starts, stops, and resumes a timer without losing accumulated time", () => {
  const firstStart = startTimer(null, 1_000);
  assert.equal(firstStart.kind, "started");
  if (firstStart.kind !== "started") return;

  const firstStop = stopTimer(firstStart.state, 66_000);
  assert.equal(firstStop.kind, "stopped");
  if (firstStop.kind !== "stopped") return;
  assert.equal(firstStop.currentTime, 65_000);
  assert.equal(firstStop.state.totalTime, 65_000);

  const resumed = startTimer(firstStop.state, 100_000);
  assert.equal(resumed.kind, "started");
  if (resumed.kind !== "started") return;
  assert.equal(resumed.isNew, false);
  assert.equal(resumed.previousTotalTime, 65_000);
});

test("rejects invalid persisted state and formats durations", () => {
  assert.equal(parseTimerState('{"begin":true}'), null);
  assert.equal(parseTimerState("not json"), null);
  assert.equal(formatDuration(3_661_000), "1小时1分钟1秒");
});

test("includes the active segment when calculating total time", () => {
  assert.equal(
    totalDurationAt(
      {
        begin: true,
        totalTime: 60_000,
        lastBeginTime: 100_000,
        lastEndTime: 90_000,
      },
      130_000,
    ),
    90_000,
  );
  assert.equal(
    totalDurationAt(
      {
        begin: false,
        totalTime: 60_000,
        lastBeginTime: 100_000,
        lastEndTime: 120_000,
      },
      130_000,
    ),
    60_000,
  );
});

test("creates a paused recovery state and discards stale active time", () => {
  assert.deepEqual(createPausedTimer(5_000), {
    begin: false,
    totalTime: 0,
    lastBeginTime: 5_000,
    lastEndTime: 5_000,
  });
  assert.deepEqual(
    restartActiveTimer(
      {
        begin: true,
        totalTime: 60_000,
        lastBeginTime: 100_000,
        lastEndTime: 90_000,
      },
      130_000,
    ),
    {
      begin: true,
      totalTime: 60_000,
      lastBeginTime: 130_000,
      lastEndTime: 90_000,
    },
  );
});
