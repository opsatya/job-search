import { join } from "node:path";
import { loadEnvFile, assertSafeTestDatabaseUrl } from "../../src/config/env-file";

// Runs before every test file, before any module imports the Prisma client.
const fileEnv = loadEnvFile(join(__dirname, "../../.env"));
process.env.DATABASE_URL = assertSafeTestDatabaseUrl(
  process.env.DATABASE_URL_TEST ?? fileEnv.DATABASE_URL_TEST,
  process.env.DATABASE_URL ?? fileEnv.DATABASE_URL,
);
