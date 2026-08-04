import assert from "node:assert/strict";
import test from "node:test";

import {
  MessageRenderer,
  messageTemplateDefinitions,
  registerMessageTemplateConfigs,
} from "../../src/messages.ts";
import {
  activeTimerStorageKey,
  locatorStorageKey,
  metadataStorageKey,
  timerStorageKey,
} from "../../src/storage-keys.ts";

test("every message template has a non-empty default reply", () => {
  for (const [key, definition] of Object.entries(messageTemplateDefinitions)) {
    assert.ok(definition.defaults.length > 0, `${key} must have a default`);
    assert.ok(
      definition.defaults.every((text) => text.trim() !== ""),
      `${key} must not contain blank defaults`,
    );
  }
  assert.match(
    messageTemplateDefinitions.timerStopped.defaults[0] ?? "",
    /\{\$t日志增强_本次时长\}/u,
  );
  assert.doesNotMatch(
    messageTemplateDefinitions.timerStopped.defaults[0] ?? "",
    /^\*/u,
  );
  assert.match(
    messageTemplateDefinitions.timerStopped.defaults[0] ?? "",
    /^当前记录/u,
  );
  assert.match(
    messageTemplateDefinitions.timerResumed.defaults[0] ?? "",
    /\{\$t日志增强_累计时长\}/u,
  );
});

test("encoded storage keys keep group and log-name boundaries unambiguous", () => {
  assert.notEqual(
    timerStorageKey("group:one", "two"),
    timerStorageKey("group", "one:two"),
  );
  assert.equal(locatorStorageKey("QQ-Group:123"), "locator:QQ-Group%3A123");
  assert.equal(
    activeTimerStorageKey("QQ-Group:123"),
    "timer-active:QQ-Group%3A123",
  );
  assert.equal(
    metadataStorageKey("QQ-Group:123", "雾都"),
    "metadata:QQ-Group%3A123:%E9%9B%BE%E9%83%BD",
  );
});

test("message renderer registers templates and renders the selected configured text", () => {
  const configurations = new Map<string, string[]>();
  const variables = new Map<string, string>();
  const registrations: Array<{ key: string; group: string | undefined }> = [];
  const global = globalThis as typeof globalThis & { seal?: unknown };
  const previousSeal = global.seal;
  global.seal = {
    ext: {
      getTemplateConfig: (_extension: unknown, key: string): string[] =>
        configurations.get(key) ?? [],
      registerTemplateConfig: (
        _extension: unknown,
        key: string,
        defaults: string[],
        _description: string,
        group: string,
      ): void => {
        configurations.set(key, defaults);
        registrations.push({ key, group });
      },
    },
    format: (_ctx: unknown, text: string): string =>
      text.replace(
        /\{\$t日志增强_([^}]+)\}/gu,
        (_match, name: string) => variables.get(`$t日志增强_${name}`) ?? "",
      ),
    vars: {
      strSet: (_ctx: unknown, key: string, value: string): void => {
        variables.set(key, value);
      },
    },
  };

  try {
    const extension = {} as seal.ExtInfo;
    registerMessageTemplateConfigs(extension);
    configurations.set("message.timerStarted", [
      "候选 A {$t日志增强_日志名}",
      "候选 B {$t日志增强_日志名} 于 {$t日志增强_时间}",
    ]);
    const renderer = new MessageRenderer(extension, () => 0.75);

    assert.equal(
      renderer.render({} as seal.MsgContext, "timerStarted", {
        logName: "雾都",
        timestamp: "2026-08-04 12:00:00",
      }),
      "候选 B 雾都 于 2026-08-04 12:00:00",
    );
    assert.equal(
      registrations.length,
      Object.keys(messageTemplateDefinitions).length,
    );
    assert.ok(registrations.every((item) => item.group === "文案"));
  } finally {
    if (previousSeal === undefined) delete global.seal;
    else global.seal = previousSeal;
  }
});
