import { describe, it, expect } from "vitest";
import { submissionEmail, approvalAssignedEmail, approvedEmail, rejectedEmail } from "../../src/email/templates";

describe("Email templates", () => {
  it("submissionEmail contiene código y título", () => {
    const result = submissionEmail("DOC-001", "Test Doc", "user-1");
    expect(result.subject).toContain("DOC-001");
    expect(result.html).toContain("DOC-001");
    expect(result.html).toContain("Test Doc");
  });

  it("approvalAssignedEmail contiene código y título", () => {
    const result = approvalAssignedEmail("DOC-001", "Test Doc", "user-1");
    expect(result.subject).toContain("DOC-001");
    expect(result.html).toContain("aprobador");
    expect(result.html).toContain("Test Doc");
  });

  it("approvedEmail indica aprobado", () => {
    const result = approvedEmail("DOC-001", "Test Doc", "approver-1");
    expect(result.subject).toContain("aprobado");
    expect(result.html).toContain("aprobado");
    expect(result.html).toContain("approver-1");
  });

  it("rejectedEmail incluye comentario", () => {
    const result = rejectedEmail("DOC-001", "Test Doc", "approver-1", "Needs revision");
    expect(result.subject).toContain("rechazado");
    expect(result.html).toContain("rechazado");
    expect(result.html).toContain("Needs revision");
  });

  it("rejectedEmail sin comentario no incluye comentario", () => {
    const result = rejectedEmail("DOC-001", "Test Doc", "approver-1");
    expect(result.html).not.toContain("Comentario");
  });
});
