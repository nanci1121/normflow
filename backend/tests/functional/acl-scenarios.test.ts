import { describe, it, expect } from "vitest";
import { setupApp, teardownApp, inject, createDoc, createUser, tokenOf } from "./helpers";

describe("Escenario funcional: ACL y visibilidad de documentos", () => {
  it("Owner crea documento restricted → otro usuario no lo ve → owner concede acceso → usuario lo ve en listado y detalle → owner revoca acceso → usuario ya no lo ve", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const grantee = await createUser("reader");
    const ownerTok = tokenOf(owner.user);
    const granteeTok = tokenOf(grantee.user);

    // Paso 1: Owner crea documento restricted
    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-ACL-${Date.now()}`,
      title: "Documento Confidencial - Estrategia 2026",
      visibility: "restricted",
    });
    expect(doc.visibility).toBe("restricted");

    // Paso 2: Grantee NO debe verlo en listado ni detalle
    const listBefore = await inject(app, "GET", "/api/v1/documents", { token: granteeTok });
    expect(listBefore.statusCode).toBe(200);
    const foundBefore = listBefore.json().items.find((d: { id: string }) => d.id === doc.id);
    expect(foundBefore).toBeUndefined();

    const detailBefore = await inject(app, "GET", `/api/v1/documents/${doc.id}`, {
      token: granteeTok,
    });
    expect(detailBefore.statusCode).toBe(404);

    // Paso 3: Owner concede acceso
    const grantRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerTok,
      payload: { userId: grantee.user.id, actorId: owner.user.id },
    });
    expect(grantRes.statusCode).toBe(201);
    expect(grantRes.json().userId).toBe(grantee.user.id);

    // Paso 4: Grantee ahora ve el documento en listado y detalle
    const listAfter = await inject(app, "GET", "/api/v1/documents", { token: granteeTok });
    expect(listAfter.statusCode).toBe(200);
    const foundAfter = listAfter.json().items.find((d: { id: string }) => d.id === doc.id);
    expect(foundAfter).toBeDefined();
    expect(foundAfter.id).toBe(doc.id);

    const detailAfter = await inject(app, "GET", `/api/v1/documents/${doc.id}`, {
      token: granteeTok,
    });
    expect(detailAfter.statusCode).toBe(200);
    expect(detailAfter.json().id).toBe(doc.id);

    // Paso 5: Owner revoca acceso
    const revokeRes = await inject(app, "DELETE", `/api/v1/documents/${doc.id}/access/${grantee.user.id}`, {
      token: ownerTok,
    });
    expect(revokeRes.statusCode).toBe(200);

    // Paso 6: Grantee ya no ve el documento
    const listAfterRevoke = await inject(app, "GET", "/api/v1/documents", { token: granteeTok });
    const foundFinal = listAfterRevoke.json().items.find((d: { id: string }) => d.id === doc.id);
    expect(foundFinal).toBeUndefined();

    await teardownApp(app);
  });

  it("Admin ve todos los documentos restricted sin necesidad de grant explícito", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const admin = await createUser("admin");
    const ownerTok = tokenOf(owner.user);
    const adminTok = tokenOf(admin.user);

    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-ACL-ADMIN-${Date.now()}`,
      title: "Documento restricted - solo admin",
      visibility: "restricted",
    });

    // Admin debe verlo sin necesidad de grant
    const listRes = await inject(app, "GET", "/api/v1/documents", { token: adminTok });
    expect(listRes.statusCode).toBe(200);
    const found = listRes.json().items.find((d: { id: string }) => d.id === doc.id);
    expect(found).toBeDefined();

    const detailRes = await inject(app, "GET", `/api/v1/documents/${doc.id}`, { token: adminTok });
    expect(detailRes.statusCode).toBe(200);

    // Solo el owner puede listar grants, no el admin — no se verifica aquí

    await teardownApp(app);
  });

  it("Owner concede acceso a restricted → grantee no puede conceder acceso a terceros", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const grantee = await createUser("reader");
    const thirdParty = await createUser("reader");
    const ownerTok = tokenOf(owner.user);
    const granteeTok = tokenOf(grantee.user);

    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-ACL-NOGRANT-${Date.now()}`,
      title: "Restricted - sin permisos de grant",
      visibility: "restricted",
    });

    // Conceder acceso a grantee
    await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerTok,
      payload: { userId: grantee.user.id, actorId: owner.user.id },
    });

    // Grantee intenta conceder acceso a thirdParty → debe fallar
    const grantRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: granteeTok,
      payload: { userId: thirdParty.user.id, actorId: grantee.user.id },
    });
    expect(grantRes.statusCode).toBe(403);

    await teardownApp(app);
  });
});
