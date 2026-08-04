import assert from "node:assert/strict";
import test from "node:test";

import { loadLogMetadata } from "../../src/session-store.ts";
import { metadataStorageKey, timerStorageKey } from "../../src/storage-keys.ts";
import { loadTimer, startLogTimer, stopLogTimer } from "../../src/timer.ts";

function createExtension(initial: Readonly<Record<string, string>> = {}): {
  extension: seal.ExtInfo;
  storage: Map<string, string>;
} {
  const storage = new Map(Object.entries(initial));
  return {
    extension: {
      storageGet: (key: string): string => storage.get(key) ?? "",
      storageSet: (key: string, value: string): void => {
        storage.set(key, value);
      },
    } as seal.ExtInfo,
    storage,
  };
}

function withSettings(run: () => void): void {
  const global = globalThis as typeof globalThis & { seal?: unknown };
  const previousSeal = global.seal;
  global.seal = {
    ext: {
      getIntConfig: (): number => 30,
    },
  };
  try {
    run();
  } finally {
    if (previousSeal === undefined) delete global.seal;
    else global.seal = previousSeal;
  }
}

test("persists normal start and stop as one coherent session", () => {
  withSettings(() => {
    const { extension } = createExtension();
    const started = startLogTimer(extension, "group", "雾都", 1_000, "new");
    const stopped = stopLogTimer(extension, "group", "雾都", 5_000, true);

    assert.equal(started.kind, "started");
    assert.equal(stopped.kind, "stopped");
    if (stopped.kind !== "stopped") return;
    assert.equal(stopped.state.totalTime, 4_000);
    assert.deepEqual(loadLogMetadata(extension, "group", "雾都")?.segments, [
      { startedAt: 1_000, endedAt: 5_000 },
    ]);
  });
});

test("repairs missing and stale state without inflating accumulated time", () => {
  withSettings(() => {
    const missing = createExtension();
    const missingStart = startLogTimer(
      missing.extension,
      "group",
      "雾都",
      1_000,
      "on",
    );
    assert.equal(missingStart.kind, "recovered-missing");
    assert.equal(
      loadLogMetadata(missing.extension, "group", "雾都")?.synchronization
        ?.kind,
      "recovered-missing-start",
    );

    const stale = createExtension({
      [timerStorageKey("group", "雾都")]: JSON.stringify({
        begin: true,
        totalTime: 60_000,
        lastBeginTime: 1_000,
        lastEndTime: 0,
      }),
      [metadataStorageKey("group", "雾都")]: JSON.stringify({
        id: "legacy",
        createdAt: 0,
        segments: [{ startedAt: 1_000, endedAt: null }],
        bookmarks: [],
      }),
    });
    const repaired = startLogTimer(
      stale.extension,
      "group",
      "雾都",
      120_000,
      "on",
    );
    const missingStop = stopLogTimer(
      createExtension().extension,
      "group",
      "长夜",
      3_000,
      true,
    );
    const pausedWithoutMetadata = createExtension({
      [timerStorageKey("group", "旧港")]: JSON.stringify({
        begin: false,
        totalTime: 12_000,
        lastBeginTime: 1_000,
        lastEndTime: 2_000,
      }),
    });
    const pausedStop = stopLogTimer(
      pausedWithoutMetadata.extension,
      "group",
      "旧港",
      3_000,
      true,
    );

    assert.equal(repaired.kind, "recovered-active");
    assert.equal(
      loadTimer(stale.extension, "group", "雾都")?.totalTime,
      60_000,
    );
    assert.deepEqual(
      loadLogMetadata(stale.extension, "group", "雾都")?.segments,
      [{ startedAt: 120_000, endedAt: null }],
    );
    assert.equal(missingStop.kind, "recovered-missing");
    assert.equal(pausedStop.kind, "recovered-paused");
    assert.equal(
      loadLogMetadata(pausedWithoutMetadata.extension, "group", "旧港")
        ?.synchronization?.kind,
      "recovered-paused-stop",
    );
  });
});
