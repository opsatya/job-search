import { execSync } from "node:child_process";
import { join } from "node:path";
import { loadEnvFile, assertSafeTestDatabaseUrl } from "../src/config/env-file";

const fileEnv = loadEnvFile(join(__dirname, "../.env"));
const testUrl = assertSafeTestDatabaseUrl(
  process.env.DATABASE_URL_TEST ?? fileEnv.DATABASE_URL_TEST,
  process.env.DATABASE_URL ?? fileEnv.DATABASE_URL,
);
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  cwd: join(__dirname, ".."),
  env: { ...process.env, DATABASE_URL: testUrl },
});
