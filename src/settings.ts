const configurationGroup = "日志增强";

const segmentLimitKey = "retention.segmentLimit";
const bookmarkLimitKey = "retention.bookmarkLimit";

export function registerSettings(extension: seal.ExtInfo): void {
  seal.ext.registerIntConfig(
    extension,
    segmentLimitKey,
    30,
    "每份日志最多保留的计时分段数，范围为 1 至 100。",
    configurationGroup,
  );
  seal.ext.registerIntConfig(
    extension,
    bookmarkLimitKey,
    50,
    "每份日志最多保留的书签数，范围为 1 至 100。",
    configurationGroup,
  );
}

function getLimit(
  extension: seal.ExtInfo,
  key: string,
  fallback: number,
): number {
  const configured = seal.ext.getIntConfig(extension, key);
  if (!Number.isFinite(configured)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(configured)));
}

export function segmentLimit(extension: seal.ExtInfo): number {
  return getLimit(extension, segmentLimitKey, 30);
}

export function bookmarkLimit(extension: seal.ExtInfo): number {
  return getLimit(extension, bookmarkLimitKey, 50);
}
