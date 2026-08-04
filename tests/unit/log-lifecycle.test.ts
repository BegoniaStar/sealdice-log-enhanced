import assert from "node:assert/strict";
import test from "node:test";

import { detectLogTransition } from "../../src/log-lifecycle.ts";

test("only recognizes successful native log state transitions", () => {
  assert.deepEqual(
    detectLogTransition(
      "on",
      { isOn: false, logName: "雾都" },
      { isOn: true, logName: "雾都" },
    ),
    { kind: "started", logName: "雾都" },
  );
  assert.deepEqual(
    detectLogTransition(
      "new",
      { isOn: false, logName: "" },
      { isOn: false, logName: "" },
    ),
    { kind: "none" },
  );
  assert.deepEqual(
    detectLogTransition(
      "off",
      { isOn: true, logName: "雾都" },
      { isOn: false, logName: "雾都" },
    ),
    { kind: "stopped", logName: "雾都" },
  );
  assert.deepEqual(
    detectLogTransition(
      "off",
      { isOn: false, logName: "雾都" },
      { isOn: false, logName: "雾都" },
    ),
    { kind: "none" },
  );
  assert.deepEqual(
    detectLogTransition(
      "end",
      { isOn: false, logName: "雾都" },
      { isOn: false, logName: "" },
    ),
    { kind: "stopped", logName: "雾都" },
  );
  assert.deepEqual(
    detectLogTransition(
      "new",
      { isOn: true, logName: "雾都" },
      { isOn: true, logName: "长夜" },
    ),
    { kind: "replaced", previousLogName: "雾都", logName: "长夜" },
  );
});
