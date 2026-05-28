export interface EmailOptions {
  to: string[]
  subject: string
  html: string
}

export interface EmailService {
  send(options: EmailOptions): Promise<void>
}
