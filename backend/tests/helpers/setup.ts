import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { beforeAll, beforeEach, afterAll } from "vitest";

const TABLES = [
  "AuditEvent",
  "ApprovalWorkflowStep",
  "ApprovalWorkflow",
  "DocumentApproval",
  "DocumentVersion",
  "Document",
  "User",
];

let prisma: PrismaClient;

beforeAll(async () => {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL not set for tests");
  }

  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  await prisma.$connect();
  await prisma.$executeRawUnsafe(`SELECT 1`);
});

beforeEach(async () => {
  for (const table of TABLES) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch {
      // Ignore tables that are not present yet in this test database.
    }
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});
