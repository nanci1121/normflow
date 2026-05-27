import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL no configurado");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seedAdmin() {
  const email = (process.env["ADMIN_EMAIL"] ?? "admin@qms.local").trim().toLowerCase();
  const name = process.env["ADMIN_NAME"] ?? "QMS Admin";
  const password = process.env["ADMIN_PASSWORD"] ?? "Admin123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "admin",
      passwordHash,
      isActive: true,
    },
    create: {
      email,
      name,
      role: "admin",
      passwordHash,
      isActive: true,
    },
  });

  console.log(`[seed] admin ready: ${admin.email}`);
}

seedAdmin()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
