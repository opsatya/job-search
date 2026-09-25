import { prisma } from "../../src/db/client";

describe("prisma client", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to the database", async () => {
    const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });
});
