import { createTestUser, generateToken } from "../../helpers/factory";
import { prisma } from "../../../src/db";

export async function createUser(role: "owner" | "admin" | "approver" | "reader" = "owner") {
  return createTestUser(prisma, { role });
}

export function tokenOf(user: { id: string; email: string; name: string; role: string }) {
  return generateToken(user);
}
