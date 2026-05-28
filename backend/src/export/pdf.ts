import PDFDocument from "pdfkit";
import { AuditEvent, DocumentRecord } from "../types";

export interface AuditPdfInput {
  document: DocumentRecord;
  events: AuditEvent[];
  userName?: string;
}

export function auditToPdf(input: AuditPdfInput): PDFKit.PDFDocument {
  const { document: doc, events, userName } = input;
  const pdf = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: `Auditoría - ${doc.code}`,
      Author: userName ?? "QMS Platform",
      Subject: "Informe de auditoría documental",
    },
  });

  const pageWidth = pdf.page.width - 100;
  const leftMargin = 50;

  function header(text: string, y: number, size = 10): number {
    pdf.font("Helvetica-Bold").fontSize(size).text(text, leftMargin, y, {
      width: pageWidth,
    });
    return pdf.y + 6;
  }

  function row(label: string, value: string, y: number): number {
    pdf.font("Helvetica-Bold").fontSize(9).text(label, leftMargin, y, { width: 120, continued: true });
    pdf.font("Helvetica").fontSize(9).text(value, leftMargin + 125, y, { width: pageWidth - 125 });
    return pdf.y + 4;
  }

  // Title
  pdf.font("Helvetica-Bold").fontSize(16).text("Informe de Auditoría", leftMargin, 50, {
    width: pageWidth,
    align: "center",
  });
  pdf.moveDown(0.5);

  pdf.fontSize(8).font("Helvetica").fillColor("#666").text(`Generado: ${new Date().toISOString()}`, {
    align: "center",
  });
  pdf.fillColor("#000");
  pdf.moveDown(1);

  // Divider
  pdf.moveTo(leftMargin, pdf.y).lineTo(leftMargin + pageWidth, pdf.y).strokeColor("#ccc").stroke();
  pdf.moveDown(0.5);

  // Document info
  let y = header("Documento", pdf.y + 4, 12);
  y = row("Código", doc.code, y);
  y = row("Título", doc.title, y);
  y = row("Estado", doc.status, y);
  y = row("Categoría", doc.category, y);
  y = row("Propietario", doc.ownerId, y);
  y = row("Visibilidad", doc.visibility, y);
  y = row("Versión actual", String(doc.currentVersionId), y);
  if (doc.obsoleteReason) {
    y = row("Motivo obsolescencia", doc.obsoleteReason, y);
  }

  pdf.moveDown(0.5);
  pdf.moveTo(leftMargin, pdf.y).lineTo(leftMargin + pageWidth, pdf.y).strokeColor("#ccc").stroke();
  pdf.moveDown(0.5);

  // Audit events table
  y = header("Eventos de auditoría", pdf.y + 4, 12);

  // Table header
  const colWidths = [24, 130, 80, 70, 80];
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const colLabels = ["#", "Timestamp", "Actor", "Acción", "Detalles"];

  pdf.font("Helvetica-Bold").fontSize(7);
  let cx = leftMargin;
  colLabels.forEach((label, i) => {
    pdf.text(label, cx, y, { width: colWidths[i], align: "left" });
    cx += colWidths[i];
  });

  y += 10;
  pdf.moveTo(leftMargin, y - 3).lineTo(leftMargin + totalWidth, y - 3).strokeColor("#ccc").stroke();

  // Table rows
  events.forEach((event, index) => {
    if (y > pdf.page.height - 50) {
      pdf.addPage();
      y = 50;
    }

    const details = JSON.stringify(event.details);
    pdf.font("Helvetica").fontSize(7);
    let cx2 = leftMargin;
    const vals = [
      String(index + 1),
      event.timestamp,
      event.actorId,
      event.action,
      details.length > 50 ? details.substring(0, 50) + "..." : details,
    ];
    vals.forEach((val, i) => {
      pdf.text(val, cx2, y, { width: colWidths[i], align: "left" });
      cx2 += colWidths[i];
    });

    y += 10;
  });

  pdf.end();
  return pdf;
}
