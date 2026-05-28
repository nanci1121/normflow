import "dotenv/config";
import { buildApp } from "./app";
import { createEmailService } from "./email";

async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  const emailService = createEmailService();
  const app = buildApp(emailService);

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void main();
