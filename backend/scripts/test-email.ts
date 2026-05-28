import "dotenv/config";
import { createEmailService } from "../src/email";

async function main() {
  const emailService = createEmailService();

  if (!emailService) {
    console.error("EMAIL_HOST no configurado");
    process.exit(1);
  }

  console.log("Enviando email de prueba...");
  console.log(`Servidor: ${process.env["EMAIL_HOST"]}:${process.env["EMAIL_PORT"]}`);
  console.log(`De: ${process.env["EMAIL_FROM"]}`);
  console.log(`Para: ${process.env["EMAIL_FROM"]}`);

  try {
    await emailService.send({
      to: [process.env["EMAIL_FROM"]!],
      subject: "[QMS] Prueba de configuración email",
      html: `
        <h2>Prueba de notificaciones QMS</h2>
        <p>Este es un email de prueba para verificar la configuración SMTP.</p>
        <p>Si recibes esto, la configuración es correcta.</p>
        <hr/>
        <p style="color:gray;font-size:12px;">QMS Platform — ${new Date().toISOString()}</p>
      `,
    });
    console.log("Email enviado correctamente");
  } catch (error) {
    console.error("Error al enviar:", (error as Error).message);
    process.exit(1);
  }
}

main();
