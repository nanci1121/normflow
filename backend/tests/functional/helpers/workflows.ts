import type { App } from "./core";
import { inject } from "./core";

export async function setupWorkflow(
  app: App,
  token: string,
  category: string,
  steps: Array<{ approverId: string; responsibility: string; order: number }>,
) {
  return inject(app, "PUT", `/api/v1/approval-workflows/${category}`, {
    token,
    payload: { steps: steps.map((s) => ({ approverId: s.approverId, responsibility: s.responsibility })) },
  });
}
