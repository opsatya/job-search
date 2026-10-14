import { existsSync, readFileSync } from "node:fs";

export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function loadEnvFile(path: string): Record<string, string> {
  return existsSync(path) ? parseEnvFile(readFileSync(path, "utf-8")) : {};
}

// Tests once shared the real DATABASE_URL and wiped real data twice (Phase A
// Task 15). Refuse anything that isn't unmistakably a test database.
export function assertSafeTestDatabaseUrl(
  testUrl: string | undefined,
  realUrl: string | undefined,
): string {
  if (!testUrl) {
    throw new Error("DATABASE_URL_TEST is not set — add it to BE/.env (see .env.example)");
  }
  if (realUrl && testUrl === realUrl) {
    throw new Error("DATABASE_URL_TEST is the same as DATABASE_URL — refusing to run tests");
  }
  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, "");
  const schema = url.searchParams.get("schema") ?? "";
  if (!dbName.endsWith("_test") && !schema.endsWith("_test")) {
    throw new Error(
      "DATABASE_URL_TEST's database name or ?schema= must end in _test — refusing to run tests",
    );
  }
  return testUrl;
}
