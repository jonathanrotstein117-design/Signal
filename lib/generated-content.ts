const emDashPattern = /\s*—\s*/g;

export function replaceEmDashes(value: string) {
  if (!value.includes("—")) {
    return value;
  }

  return value
    .replace(emDashPattern, ", ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.;:])(?=[^\s)\]}])/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeGeneratedContent<T>(value: T): T {
  if (typeof value === "string") {
    return replaceEmDashes(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGeneratedContent(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeGeneratedContent(item)]),
    ) as T;
  }

  return value;
}

export function sanitizeGeneratedJsonText(output: string) {
  return output.replace(/—/g, ",");
}
