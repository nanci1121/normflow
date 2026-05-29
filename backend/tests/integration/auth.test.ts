import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app";
import { createTestUser, generateToken } from "../helpers/factory";
import { prisma } from "../../src/db";

async function inject(
  app: ReturnType<typeof buildApp>,
  method: string,
  url: string,
  opts?: { token?: string; payload?: unknown }
) {
  const headers: Record<string, string> = {};
  if (opts?.payload !== undefined) headers["content-type"] = "application/json";
  if (opts?.token) headers["authorization"] = `Bearer ${opts.token}`;

  return app.inject({
    method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    url,
    headers,
    payload: opts?.payload,
  });
}

describe("Auth API", () => {
  describe("POST /api/v1/auth/login", () => {
    it("devuelve mustChangePassword=false por defecto", async () => {
      const app = buildApp();
      await app.ready();
      const { user, password } = await createTestUser(prisma);

      const res = await inject(app, "POST", "/api/v1/auth/login", {
        payload: { email: user.email, password },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.mustChangePassword).toBe(false);

      await app.close();
    });

    it("devuelve mustChangePassword=true cuando está marcado", async () => {
      const app = buildApp();
      await app.ready();
      const { user, password } = await createTestUser(prisma);

      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });

      const res = await inject(app, "POST", "/api/v1/auth/login", {
        payload: { email: user.email, password },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.mustChangePassword).toBe(true);

      await app.close();
    });

    it("401 con credenciales inválidas", async () => {
      const app = buildApp();
      await app.ready();
      const { user } = await createTestUser(prisma);

      const res = await inject(app, "POST", "/api/v1/auth/login", {
        payload: { email: user.email, password: "wrongpassword" },
      });

      expect(res.statusCode).toBe(401);

      await app.close();
    });
  });

  describe("PATCH /api/v1/users/:id/reset-password", () => {
    it("200 como admin, cambia contraseña y marca mustChangePassword", async () => {
      const app = buildApp();
      await app.ready();
      const { user: admin } = await createTestUser(prisma, { role: "admin" });
      const { user: target } = await createTestUser(prisma);
      const token = generateToken(admin);

      const res = await inject(app, "PATCH", `/api/v1/users/${target.id}/reset-password`, {
        token,
        payload: { newPassword: "newPass12345" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.message).toBe("Contraseña restablecida correctamente");
      expect(body.temporaryPassword).toBe("newPass12345");

      const updatedUser = await prisma.user.findUnique({ where: { id: target.id } });
      expect(updatedUser?.mustChangePassword).toBe(true);

      await app.close();
    });

    it("403 si no es admin", async () => {
      const app = buildApp();
      await app.ready();
      const { user: reader } = await createTestUser(prisma, { role: "reader" });
      const { user: target } = await createTestUser(prisma);
      const token = generateToken(reader);

      const res = await inject(app, "PATCH", `/api/v1/users/${target.id}/reset-password`, {
        token,
        payload: { newPassword: "newPass12345" },
      });

      expect(res.statusCode).toBe(403);

      await app.close();
    });

    it("404 si usuario no existe", async () => {
      const app = buildApp();
      await app.ready();
      const { user: admin } = await createTestUser(prisma, { role: "admin" });
      const token = generateToken(admin);

      const res = await inject(app, "PATCH", "/api/v1/users/00000000-0000-0000-0000-000000000000/reset-password", {
        token,
        payload: { newPassword: "newPass12345" },
      });

      expect(res.statusCode).toBe(404);

      await app.close();
    });

    it("crea AuditEvent user.password_reset", async () => {
      const app = buildApp();
      await app.ready();

      const auditBefore = await prisma.auditEvent.count({
        where: { action: "user.password_reset" },
      });

      const { user: admin } = await createTestUser(prisma, { role: "admin" });
      const { user: target } = await createTestUser(prisma);
      const token = generateToken(admin);

      await inject(app, "PATCH", `/api/v1/users/${target.id}/reset-password`, {
        token,
        payload: { newPassword: "newPass12345" },
      });

      const auditAfter = await prisma.auditEvent.findMany({
        where: { action: "user.password_reset", entityId: target.id },
      });

      expect(auditAfter.length).toBe(auditBefore + 1);
      expect(auditAfter[0].actorId).toBe(admin.id);
      expect(auditAfter[0].details).toEqual({ resetBy: admin.id });

      await app.close();
    });
  });

  describe("PATCH /api/v1/auth/change-password", () => {
    it("200 cambia contraseña y limpia mustChangePassword", async () => {
      const app = buildApp();
      await app.ready();
      const { user, password } = await createTestUser(prisma);

      await prisma.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true },
      });

      const token = generateToken(user);

      const res = await inject(app, "PATCH", "/api/v1/auth/change-password", {
        token,
        payload: { currentPassword: password, newPassword: "newPass12345" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.message).toBe("Contraseña cambiada correctamente");

      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.mustChangePassword).toBe(false);

      await app.close();
    });

    it("400 si currentPassword es incorrecta", async () => {
      const app = buildApp();
      await app.ready();
      const { user } = await createTestUser(prisma);
      const token = generateToken(user);

      const res = await inject(app, "PATCH", "/api/v1/auth/change-password", {
        token,
        payload: { currentPassword: "wrongPassword", newPassword: "newPass12345" },
      });

      expect(res.statusCode).toBe(400);

      await app.close();
    });

    it("401 sin token", async () => {
      const app = buildApp();
      await app.ready();

      const res = await inject(app, "PATCH", "/api/v1/auth/change-password", {
        payload: { currentPassword: "anything", newPassword: "newPass12345" },
      });

      expect(res.statusCode).toBe(401);

      await app.close();
    });

    it("nuevo login con nueva contraseña funciona", async () => {
      const app = buildApp();
      await app.ready();
      const { user, password } = await createTestUser(prisma);
      const token = generateToken(user);

      await inject(app, "PATCH", "/api/v1/auth/change-password", {
        token,
        payload: { currentPassword: password, newPassword: "newPass12345" },
      });

      const loginRes = await inject(app, "POST", "/api/v1/auth/login", {
        payload: { email: user.email, password: "newPass12345" },
      });

      expect(loginRes.statusCode).toBe(200);

      const loginResOld = await inject(app, "POST", "/api/v1/auth/login", {
        payload: { email: user.email, password },
      });

      expect(loginResOld.statusCode).toBe(401);

      await app.close();
    });
  });
});
