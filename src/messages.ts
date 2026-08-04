interface TemplateField {
  readonly description: string;
  readonly name: string;
  readonly variable: string;
}

interface MessageTemplateDefinition {
  readonly defaults: readonly string[];
  readonly fields: readonly TemplateField[];
}

const fields = {
  bookmarkCount: {
    name: "bookmarkCount",
    variable: "$t日志增强_书签数量",
    description: "该日志已保存的书签数量",
  },
  currentDuration: {
    name: "currentDuration",
    variable: "$t日志增强_本次时长",
    description: "本次开始到停止的时长",
  },
  details: {
    name: "details",
    variable: "$t日志增强_详情",
    description: "由命令生成的多行详情文本",
  },
  markLabel: {
    name: "markLabel",
    variable: "$t日志增强_书签标签",
    description: "书签的标签文本",
  },
  markNumber: {
    name: "markNumber",
    variable: "$t日志增强_书签序号",
    description: "书签在该日志中的序号",
  },
  nativeStatus: {
    name: "nativeStatus",
    variable: "$t日志增强_原生日志状态",
    description: "SealDice 原生日志的当前状态",
  },
  logName: {
    name: "logName",
    variable: "$t日志增强_日志名",
    description: "当前日志名称",
  },
  previousEndRelative: {
    name: "previousEndRelative",
    variable: "$t日志增强_上次结束相对时间",
    description: "相对当前时刻的上次结束时间",
  },
  previousEndTime: {
    name: "previousEndTime",
    variable: "$t日志增强_上次结束时间",
    description: "格式化后的上次结束时间",
  },
  timestamp: {
    name: "timestamp",
    variable: "$t日志增强_时间",
    description: "格式化后的当前时间",
  },
  timerStatus: {
    name: "timerStatus",
    variable: "$t日志增强_计时状态",
    description: "插件侧计时的当前状态",
  },
  totalDuration: {
    name: "totalDuration",
    variable: "$t日志增强_累计时长",
    description: "该日志已经累计的时长",
  },
  segmentCount: {
    name: "segmentCount",
    variable: "$t日志增强_分段数量",
    description: "该日志已保存的计时分段数量",
  },
  synchronizationStatus: {
    name: "synchronizationStatus",
    variable: "$t日志增强_同步状态",
    description: "插件侧计时与原生日志状态的最近同步结果",
  },
} as const satisfies Record<string, TemplateField>;

export const messageTemplateDefinitions = {
  locatorReply: {
    defaults: ["（上一次记录在此处结束，若消息过久，可能无法定位。）"],
    fields: [],
  },
  timerNameRequired: {
    defaults: ["未指定记录名称，无法开始计时。"],
    fields: [],
  },
  timerAlreadyRunning: {
    defaults: ["当前记录“{$t日志增强_日志名}”已在计时中。"],
    fields: [fields.logName],
  },
  timerStarted: {
    defaults: ["记录“{$t日志增强_日志名}”已开始计时。"],
    fields: [fields.logName, fields.timestamp],
  },
  timerResumed: {
    defaults: [
      "故事“{$t日志增强_日志名}”的记录已经继续开启，计时已恢复。\n目前累计计时：{$t日志增强_累计时长}\n上一次暂停计时：{$t日志增强_上次结束相对时间}（{$t日志增强_上次结束时间}）",
    ],
    fields: [
      fields.logName,
      fields.timestamp,
      fields.totalDuration,
      fields.previousEndRelative,
      fields.previousEndTime,
    ],
  },
  timerStopped: {
    defaults: [
      "当前记录“{$t日志增强_日志名}”已经暂停计时。\n本次计时：{$t日志增强_本次时长}\n目前累计计时：{$t日志增强_累计时长}",
    ],
    fields: [
      fields.logName,
      fields.timestamp,
      fields.currentDuration,
      fields.totalDuration,
    ],
  },
  timerInfo: {
    defaults: [
      "记录“{$t日志增强_日志名}”\n原生日志：{$t日志增强_原生日志状态}\n计时状态：{$t日志增强_计时状态}\n累计计时：{$t日志增强_累计时长}\n计时分段：{$t日志增强_分段数量}\n书签：{$t日志增强_书签数量}\n同步状态：{$t日志增强_同步状态}",
    ],
    fields: [
      fields.logName,
      fields.nativeStatus,
      fields.timerStatus,
      fields.totalDuration,
      fields.segmentCount,
      fields.bookmarkCount,
      fields.synchronizationStatus,
    ],
  },
  timerRecoveredMissingStarted: {
    defaults: [
      "记录“{$t日志增强_日志名}”已开始计时。\n未找到已保存的插件计时记录，已从现在开始建立计时。\n目前累计计时：{$t日志增强_累计时长}",
    ],
    fields: [fields.logName, fields.totalDuration],
  },
  timerRecoveredActiveStarted: {
    defaults: [
      "记录“{$t日志增强_日志名}”已开始计时。\n检测到未关闭的插件计时，已丢弃无法确认的本段时长并从现在重新计时。\n目前累计计时：{$t日志增强_累计时长}",
    ],
    fields: [fields.logName, fields.totalDuration],
  },
  timerRecoveredMissingStopped: {
    defaults: [
      "当前记录“{$t日志增强_日志名}”已经暂停计时。\n未找到活动中的插件计时，已创建暂停状态；无法确认的本次时长未计入累计。\n目前累计计时：{$t日志增强_累计时长}",
    ],
    fields: [fields.logName, fields.totalDuration],
  },
  timerRecoveredPausedStopped: {
    defaults: [
      "当前记录“{$t日志增强_日志名}”已经暂停计时。\n检测到插件计时已经暂停，已修复未关闭的分段；本次时长未重复计入累计。\n目前累计计时：{$t日志增强_累计时长}",
    ],
    fields: [fields.logName, fields.totalDuration],
  },
  syncNotRecorded: {
    defaults: ["未记录（将在下次启停时补全）"],
    fields: [],
  },
  syncNormal: {
    defaults: ["正常"],
    fields: [],
  },
  syncRecoveredMissingStart: {
    defaults: [
      "{$t日志增强_时间} 自动修复：开启时未找到计时记录，已从当前时刻建立",
    ],
    fields: [fields.timestamp],
  },
  syncRecoveredActiveStart: {
    defaults: [
      "{$t日志增强_时间} 自动修复：开启时发现未关闭的旧计时，已丢弃无法确认的本段时长",
    ],
    fields: [fields.timestamp],
  },
  syncRecoveredMissingStop: {
    defaults: [
      "{$t日志增强_时间} 自动修复：停止时未找到活动计时，已创建暂停状态",
    ],
    fields: [fields.timestamp],
  },
  syncRecoveredPausedStop: {
    defaults: [
      "{$t日志增强_时间} 自动修复：停止时发现计时已暂停，已修复未关闭的分段",
    ],
    fields: [fields.timestamp],
  },
  timerHistory: {
    defaults: ["记录“{$t日志增强_日志名}”的计时历史：\n{$t日志增强_详情}"],
    fields: [fields.logName, fields.details],
  },
  timerRecap: {
    defaults: [
      "《{$t日志增强_日志名}》会话摘要\n累计计时：{$t日志增强_累计时长}\n计时分段：{$t日志增强_分段数量}\n书签：{$t日志增强_书签数量}\n{$t日志增强_详情}",
    ],
    fields: [
      fields.logName,
      fields.totalDuration,
      fields.segmentCount,
      fields.bookmarkCount,
      fields.details,
    ],
  },
  timerInfoMissing: {
    defaults: ["未找到可供查看的日志计时记录。"],
    fields: [],
  },
  markAdded: {
    defaults: [
      "已在记录“{$t日志增强_日志名}”中添加书签 #{$t日志增强_书签序号}：{$t日志增强_书签标签}",
    ],
    fields: [fields.logName, fields.markNumber, fields.markLabel],
  },
  markLabelRequired: {
    defaults: ["请在 .logmark 后填写书签标签。"],
    fields: [],
  },
  markList: {
    defaults: ["记录“{$t日志增强_日志名}”的书签：\n{$t日志增强_详情}"],
    fields: [fields.logName, fields.details],
  },
  markEmpty: {
    defaults: ["记录“{$t日志增强_日志名}”还没有书签。"],
    fields: [fields.logName],
  },
  markNoActiveLog: {
    defaults: ["当前没有正在记录的日志，无法添加书签。"],
    fields: [],
  },
  markOutOfRange: {
    defaults: ["未找到指定序号的书签。"],
    fields: [],
  },
  markReferenceUnavailable: {
    defaults: ["该书签没有可用的 QQ 消息引用。"],
    fields: [],
  },
  markReference: {
    defaults: ["书签 #{$t日志增强_书签序号}：{$t日志增强_书签标签}"],
    fields: [fields.markNumber, fields.markLabel],
  },
} as const satisfies Record<string, MessageTemplateDefinition>;

export type MessageTemplateKey = keyof typeof messageTemplateDefinitions;
export type MessageTemplateValues = Readonly<Record<string, string>>;

const templateKeys = Object.keys(
  messageTemplateDefinitions,
) as MessageTemplateKey[];
const templateFields: TemplateField[] = [];
for (const key of templateKeys)
  for (const field of messageTemplateDefinitions[key].fields)
    if (!templateFields.some((item) => item.variable === field.variable))
      templateFields.push(field);

function templateDescription(definition: MessageTemplateDefinition): string {
  const variables = definition.fields
    .map((field) => `${field.variable}：${field.description}`)
    .join("\n");
  return (
    "可填写多条候选文案，发送时随机选择一条。支持 SealDice 原生模板语法。" +
    (variables === "" ? "" : `\n可用变量：\n${variables}`)
  );
}

export function registerMessageTemplateConfigs(extension: seal.ExtInfo): void {
  for (const key of templateKeys) {
    const definition = messageTemplateDefinitions[key];
    seal.ext.registerTemplateConfig(
      extension,
      `message.${key}`,
      [...definition.defaults],
      templateDescription(definition),
      "文案",
    );
  }
}

export class MessageRenderer {
  private readonly extension: seal.ExtInfo;
  private readonly random: () => number;

  public constructor(
    extension: seal.ExtInfo,
    random: () => number = Math.random,
  ) {
    this.extension = extension;
    this.random = random;
  }

  public render(
    ctx: seal.MsgContext,
    key: MessageTemplateKey,
    values: MessageTemplateValues = {},
  ): string {
    for (const field of templateFields)
      seal.vars.strSet(ctx, field.variable, values[field.name] ?? "");
    const configured = seal.ext
      .getTemplateConfig(this.extension, `message.${key}`)
      .map((item) => item.trim())
      .filter((item) => item !== "");
    const templates =
      configured.length > 0
        ? configured
        : messageTemplateDefinitions[key].defaults;
    const selected = templates[Math.floor(this.random() * templates.length)];
    return seal.format(
      ctx,
      selected ?? messageTemplateDefinitions[key].defaults[0],
    );
  }
}
