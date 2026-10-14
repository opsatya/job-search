import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.test.ts"],
  clearMocks: true,
  setupFiles: ["<rootDir>/test/setup/test-env.ts"],
};

export default config;
