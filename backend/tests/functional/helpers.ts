// Lightweight facade — re-exports from domain helpers
export { createDoc } from "./helpers/documents";
export { createUser, tokenOf } from "./helpers/auth";
export { setupWorkflow } from "./helpers/workflows";
export { getAuditEvents } from "./helpers/audit";

// Core test utilities (app lifecycle, HTTP inject)
export { inject, setupApp, teardownApp } from "./helpers/core";
export type { App } from "./helpers/core";
