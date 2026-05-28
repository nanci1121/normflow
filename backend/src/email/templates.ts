export function submissionEmail(docCode: string, docTitle: string, ownerName: string): { subject: string; html: string } {
  return {
    subject: `[QMS] Documento enviado a revisión: ${docCode}`,
    html: `<p>El documento <strong>${docCode}</strong> — <em>${docTitle}</em> ha sido enviado a revisión por <strong>${ownerName}</strong>.</p>`,
  };
}

export function approvalAssignedEmail(docCode: string, docTitle: string, ownerName: string): { subject: string; html: string } {
  return {
    subject: `[QMS] Se requiere tu aprobación: ${docCode}`,
    html: `<p>Se te ha asignado como aprobador del documento <strong>${docCode}</strong> — <em>${docTitle}</em> por <strong>${ownerName}</strong>.</p><p>Por favor, revisa y aprueba o rechaza el documento.</p>`,
  };
}

export function approvedEmail(docCode: string, docTitle: string, approverName: string): { subject: string; html: string } {
  return {
    subject: `[QMS] Documento aprobado: ${docCode}`,
    html: `<p>El documento <strong>${docCode}</strong> — <em>${docTitle}</em> ha sido <strong style="color:green">aprobado</strong> por <strong>${approverName}</strong>.</p>`,
  };
}

export function rejectedEmail(docCode: string, docTitle: string, approverName: string, comment?: string): { subject: string; html: string } {
  return {
    subject: `[QMS] Documento rechazado: ${docCode}`,
    html: `<p>El documento <strong>${docCode}</strong> — <em>${docTitle}</em> ha sido <strong style="color:red">rechazado</strong> por <strong>${approverName}</strong>.${comment ? `<br/>Comentario: ${comment}` : ""}</p>`,
  };
}
