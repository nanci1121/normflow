import nodemailer from "nodemailer";
import type { EmailOptions, EmailService } from "./service";

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  rejectUnauthorized?: boolean
}

export class SmtpEmailService implements EmailService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      tls: { rejectUnauthorized: config.rejectUnauthorized ?? true },
    });
    this.from = config.from;
  }

  async send(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to.join(", "),
      subject: options.subject,
      html: options.html,
    });
  }
}
