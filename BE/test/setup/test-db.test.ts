import { prisma } from "../../src/db/client";

describe("test database isolation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs against a _test database or schema", async () => {
    const [row] = await prisma.$queryRaw<
      Array<{ db: string; schema: string }>
    >`SELECT current_database() AS db, current_schema() AS schema`;
    expect(row.db.endsWith("_test") || row.schema.endsWith("_test")).toBe(true);
  });
});
