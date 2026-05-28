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

async function seedVenancio() {
  const email = "venancio.morales@huayicompressor.es";
  const name = "Venancio Morales Valle";
  const password = "12345678";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: "admin", passwordHash, isActive: true },
    create: { email, name, role: "admin", passwordHash, isActive: true },
  });

  console.log(`[seed] user ready: ${user.email} (${user.role})`);
}

const APPROVERS = [
  { name: "Analista Calidad 1", email: "calidad.1@qms.local" },
  { name: "Analista Calidad 2", email: "calidad.2@qms.local" },
  { name: "Analista Calidad 3", email: "calidad.3@qms.local" },
  { name: "Analista Calidad 4", email: "calidad.4@qms.local" },
  { name: "Analista Calidad 5", email: "calidad.5@qms.local" },
] as const;

async function seedApprovers() {
  const passwordHash = await bcrypt.hash("Calidad123!", 12);

  for (const a of APPROVERS) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, role: "approver", passwordHash, isActive: true },
      create: { email: a.email, name: a.name, role: "approver", passwordHash, isActive: true },
    });
    console.log(`[seed] approver ready: ${user.email} (${user.name})`);
  }
}

seedAdmin()
  .then(() => seedVenancio())
  .then(() => seedApprovers())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
