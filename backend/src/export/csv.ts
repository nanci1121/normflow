import { AuditEvent } from "../types";

function escapeCsv(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function auditToCsv(events: AuditEvent[]): string {
  const header = [
    "ID",
    "Timestamp",
    "ActorId",
    "Action",
    "EntityType",
    "EntityId",
    "Details",
  ];

  const rows = events.map((e) =>
    [
      e.id,
      e.timestamp,
      e.actorId,
      e.action,
      e.entityType,
      e.entityId,
      JSON.stringify(e.details),
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [header.join(","), ...rows].join("\r\n");
}
