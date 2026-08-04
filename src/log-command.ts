export type LogAction = "new" | "on" | "off" | "end" | "halt";

export type ParsedLogCommand = {
  action: LogAction;
  logName: string;
};

const actions: readonly LogAction[] = ["halt", "end", "new", "off", "on"];

/** Supports both `.log on name` and the legacy compact `.log onname` form. */
export function parseLogCommand(
  cmdArgs: seal.CmdArgs,
): ParsedLogCommand | null {
  const first = cmdArgs.getArgN(1);
  if (!first) return null;

  for (const action of actions) {
    if (first === action) return { action, logName: cmdArgs.getArgN(2) };
    if (first.startsWith(action))
      return { action, logName: first.slice(action.length) };
  }
  return null;
}
