import { describe, it, expect } from "vitest";
import { setupApp, teardownApp, inject, createUser, tokenOf } from "./helpers";
import { prisma } from "../../src/db";

describe("Password Reset — functional scenarios", () => {
  it("admin resetea contraseña → mustChangePassword=true → usuario cambia contraseña → login con nueva contraseña", async () => {
    const app = await setupApp();

    const admin = await createUser("admin");
    const adminToken = tokenOf(admin.user);

    const user = await createUser("reader");
    const userPassword = user.password;

    const initialLogin = await inject(app, "POST", "/api/v1/auth/login", {
      payload: { email: user.user.email, password: userPassword },
    });
    expect(initialLogin.statusCode).toBe(200);
    expect(initialLogin.json().mustChangePassword).toBe(false);

    const resetRes = await inject(app, "PATCH", `/api/v1/users/${user.user.id}/reset-password`, {
      token: adminToken,
      payload: { newPassword: "tempPass99" },
    });
    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json().message).toBe("Contraseña restablecida correctamente");
    expect(resetRes.json().temporaryPassword).toBe("tempPass99");

    const loginAfterReset = await inject(app, "POST", "/api/v1/auth/login", {
      payload: { email: user.user.email, password: "tempPass99" },
    });
    expect(loginAfterReset.statusCode).toBe(200);
    expect(loginAfterReset.json().mustChangePassword).toBe(true);

    const changePwToken = loginAfterReset.json().accessToken;

    const changeRes = await inject(app, "PATCH", "/api/v1/auth/change-password", {
      token: changePwToken,
      payload: { currentPassword: "tempPass99", newPassword: "finalPass42" },
    });
    expect(changeRes.statusCode).toBe(200);

    const loginFinal = await inject(app, "POST", "/api/v1/auth/login", {
      payload: { email: user.user.email, password: "finalPass42" },
    });
    expect(loginFinal.statusCode).toBe(200);
    expect(loginFinal.json().mustChangePassword).toBe(false);

    const loginOld = await inject(app, "POST", "/api/v1/auth/login", {
      payload: { email: user.user.email, password: "tempPass99" },
    });
    expect(loginOld.statusCode).toBe(401);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { action: "user.password_reset", entityId: user.user.id },
    });
    expect(auditEvents.length).toBe(1);
    expect(auditEvents[0].actorId).toBe(admin.user.id);

    await teardownApp(app);
  });

  it("non-admin no puede resetear contraseña de otro usuario", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const reader = await createUser("reader");
    const ownerToken = tokenOf(owner.user);

    const res = await inject(app, "PATCH", `/api/v1/users/${reader.user.id}/reset-password`, {
      token: ownerToken,
      payload: { newPassword: "hackerPass99" },
    });

    expect(res.statusCode).toBe(403);

    await teardownApp(app);
  });

  it("cambio de contraseña con currentPassword incorrecta", async () => {
    const app = await setupApp();

    const user = await createUser("reader");
    const userToken = tokenOf(user.user);

    const res = await inject(app, "PATCH", "/api/v1/auth/change-password", {
      token: userToken,
      payload: { currentPassword: "wrongPassword", newPassword: "newPass12345" },
    });

    expect(res.statusCode).toBe(400);

    await teardownApp(app);
  });

  it("login falla con contraseña incorrecta", async () => {
    const app = await setupApp();

    const user = await createUser("reader");

    const res = await inject(app, "POST", "/api/v1/auth/login", {
      payload: { email: user.user.email, password: "wrongPassword" },
    });

    expect(res.statusCode).toBe(401);

    await teardownApp(app);
  });
});
