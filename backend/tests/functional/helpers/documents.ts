import type { App } from "./core";
import { inject } from "./core";

export async function createDoc(
  app: App,
  token: string,
  ownerId: string,
  overrides?: {
    code?: string;
    title?: string;
    category?: string;
    visibility?: string;
  }
) {
  const res = await inject(app, "POST", "/api/v1/documents", {
    token,
    payload: {
      code: overrides?.code || `FUNC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: overrides?.title || "Functional Test Document",
      description: "Documento creado durante test funcional",
      category: overrides?.category || "quality",
      standardTags: [],
      ownerId,
      visibility: overrides?.visibility || "internal",
      content: "Contenido del documento de prueba",
      createdBy: ownerId,
    },
  });
  return { status: res.statusCode, body: res.json() };
}
