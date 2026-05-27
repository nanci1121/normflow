import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { UserRole } from "../../src/types";

const JWT_SECRET = process.env["JWT_SECRET"] || "test-jwt-secret";

export async function createTestUser(prisma: PrismaClient, overrides?: {
  email?: string;
  name?: string;
  role?: UserRole;
}) {
  const email = overrides?.email || `test-${randomUUID()}@example.com`;
  const passwordHash = await bcrypt.hash("password123", 4);

  const user = await prisma.user.create({
    data: {
      email,
      name: overrides?.name || "Test User",
      role: overrides?.role || "owner",
      passwordHash,
      isActive: true,
    },
  });

  return { user, password: "password123" };
}

export function generateToken(user: { id: string; email: string; name: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}
