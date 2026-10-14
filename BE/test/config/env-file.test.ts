import { parseEnvFile, assertSafeTestDatabaseUrl } from "../../src/config/env-file";

describe("parseEnvFile", () => {
  it("parses KEY=value lines, strips quotes, ignores comments and blanks", () => {
    const env = parseEnvFile(
      '# comment\nDATABASE_URL="postgresql://u:p@localhost:5432/db"\n\nOLLAMA_MODEL=llama3.1\nEMPTY=\n',
    );
    expect(env).toEqual({
      DATABASE_URL: "postgresql://u:p@localhost:5432/db",
      OLLAMA_MODEL: "llama3.1",
      EMPTY: "",
    });
  });
});

describe("assertSafeTestDatabaseUrl", () => {
  const REAL = "postgresql://u:p@localhost:5432/job_search_agent";

  it("accepts a database whose name ends in _test", () => {
    const url = "postgresql://u:p@localhost:5432/job_search_agent_test";
    expect(assertSafeTestDatabaseUrl(url, REAL)).toBe(url);
  });

  it("accepts the real database with a schema parameter ending in _test", () => {
    const url = `${REAL}?schema=job_search_agent_test`;
    expect(assertSafeTestDatabaseUrl(url, REAL)).toBe(url);
  });

  it("refuses a missing URL", () => {
    expect(() => assertSafeTestDatabaseUrl(undefined, REAL)).toThrow(/DATABASE_URL_TEST is not set/);
  });

  it("refuses the real database URL", () => {
    expect(() => assertSafeTestDatabaseUrl(REAL, REAL)).toThrow(/same as DATABASE_URL/);
  });

  it("refuses a URL that is not clearly a test database", () => {
    expect(() =>
      assertSafeTestDatabaseUrl("postgresql://u:p@localhost:5432/other", REAL),
    ).toThrow(/must end in _test/);
  });
});
