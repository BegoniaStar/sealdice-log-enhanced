import assert from "node:assert/strict";
import test from "node:test";

import {
  addBookmark,
  closeOpenSegment,
  createLogMetadata,
  markSynchronized,
  parseLogMetadata,
  recordSegmentEnd,
  recordSegmentStart,
  restartOpenSegment,
} from "../../src/session-metadata.ts";

test("keeps a bounded, closed history of timer segments", () => {
  const initial = createLogMetadata(1_000, () => 0.5);
  const started = recordSegmentStart(initial, 2_000, 2);
  const stopped = recordSegmentEnd(started, 2_000, 5_000, 2);
  const resumed = recordSegmentStart(stopped, 8_000, 2);
  const completed = recordSegmentEnd(resumed, 8_000, 11_000, 2);
  const latest = recordSegmentStart(completed, 13_000, 2);

  assert.equal(initial.id, "log-rs-0zik0zk");
  assert.deepEqual(latest.segments, [
    { startedAt: 8_000, endedAt: 11_000 },
    { startedAt: 13_000, endedAt: null },
  ]);
});

test("adds bounded bookmarks and rejects malformed persisted metadata", () => {
  const initial = createLogMetadata(1_000, () => 0);
  const withFirst = addBookmark(
    initial,
    { createdAt: 2_000, label: "开场", messageId: "10" },
    1,
  );
  const withLatest = addBookmark(
    withFirst,
    { createdAt: 3_000, label: "转场", messageId: null },
    1,
  );

  assert.deepEqual(withLatest.bookmarks, [
    { createdAt: 3_000, label: "转场", messageId: null },
  ]);
  assert.equal(parseLogMetadata('{"id":"x"}'), null);
  assert.deepEqual(
    parseLogMetadata(
      '{"id":"x","createdAt":1,"segments":[{"startedAt":5,"endedAt":4}],"bookmarks":[]}',
    ),
    {
      id: "x",
      createdAt: 1,
      segments: [],
      bookmarks: [],
      synchronization: null,
    },
  );
});

test("repairs open segments without counting an unverified interval", () => {
  const initial = createLogMetadata(1_000, () => 0);
  const active = recordSegmentStart(initial, 2_000, 3);
  const restarted = restartOpenSegment(active, 5_000, 3);
  const stopped = closeOpenSegment(restarted, 7_000, 3);
  const synchronized = markSynchronized(
    stopped,
    "recovered-active-start",
    5_000,
  );

  assert.deepEqual(synchronized.segments, [
    { startedAt: 5_000, endedAt: 7_000 },
  ]);
  assert.deepEqual(synchronized.synchronization, {
    kind: "recovered-active-start",
    at: 5_000,
  });
});
