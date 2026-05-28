import { AuditEvent, DocumentRecord } from "../types";
import { auditToCsv } from "./csv";
import { auditToPdf } from "./pdf";

export type ExportFormat = "csv" | "pdf";

function pdfToBuffer(doc: Parameters<typeof auditToPdf>[0]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = auditToPdf(doc);
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
}

export async function exportAudit(
  format: ExportFormat,
  document: DocumentRecord,
  events: AuditEvent[],
  userName?: string
): Promise<{ data: Buffer | string; contentType: string; filename: string }> {
  const baseFilename = `audit_${document.code}_${Date.now()}`;

  if (format === "csv") {
    return {
      data: auditToCsv(events),
      contentType: "text/csv; charset=utf-8",
      filename: `${baseFilename}.csv`,
    };
  }

  const data = await pdfToBuffer({ document, events, userName });
  return {
    data,
    contentType: "application/pdf",
    filename: `${baseFilename}.pdf`,
  };
}
