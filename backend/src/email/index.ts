import type { EmailService } from "./service";
import { SmtpEmailService } from "./smtp";

export type { EmailService, EmailOptions } from "./service";

export function createEmailService(): EmailService | null {
  const host = process.env["EMAIL_HOST"];
  if (!host) return null;

  return new SmtpEmailService({
    host,
    port: Number(process.env["EMAIL_PORT"]) || 587,
    secure: process.env["EMAIL_SECURE"] === "true",
    user: process.env["EMAIL_USER"] ?? "",
    pass: process.env["EMAIL_PASS"] ?? "",
    from: process.env["EMAIL_FROM"] ?? "noreply@qms.local",
    rejectUnauthorized: process.env["EMAIL_REJECT_UNAUTHORIZED"] !== "false",
  });
}
