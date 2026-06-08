import type { App } from "./core";
import { inject } from "./core";

export async function getAuditEvents(app: App, docId: string, token: string) {
  const res = await inject(app, "GET", `/api/v1/documents/${docId}/audit`, { token });
  return { status: res.statusCode, events: res.json().items as Array<{ id: string; action: string; actorId: string; timestamp: string; details: Record<string, unknown>; entityId: string }> };
}
