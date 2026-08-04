import assert from "node:assert/strict";
import test from "node:test";

import { parseLogCommand } from "../../src/log-command.ts";

function commandArgs(...args: string[]): seal.CmdArgs {
  return {
    getArgN: (position: number): string => args[position - 1] ?? "",
  } as seal.CmdArgs;
}

test("parses regular and compact .log subcommands", () => {
  assert.deepEqual(parseLogCommand(commandArgs("on", "雾都")), {
    action: "on",
    logName: "雾都",
  });
  assert.deepEqual(parseLogCommand(commandArgs("new雾都")), {
    action: "new",
    logName: "雾都",
  });
  assert.deepEqual(parseLogCommand(commandArgs("halt")), {
    action: "halt",
    logName: "",
  });
});

test("ignores unrelated .log subcommands", () => {
  assert.equal(parseLogCommand(commandArgs("list")), null);
  assert.equal(parseLogCommand(commandArgs()), null);
});
