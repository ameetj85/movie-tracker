import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

export type Email = { to: string; subject: string; text: string; html?: string };

let transport: Transporter | undefined;

/** True when SMTP is configured; otherwise emails are written to the server log. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // true for port 465 (implicit TLS); 587 upgrades with STARTTLS.
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

/**
 * Send an email over SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
 * `SMTP_SECURE`, `EMAIL_FROM`). Without SMTP_HOST, the message is printed to the
 * server console instead, so password resets still work on a local install.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (!isEmailConfigured()) {
    console.info(
      `\n[email] SMTP is not configured (set SMTP_HOST to send real email). Message:\n` +
        `To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`,
    );
    return;
  }
  await getTransport().sendMail({
    from: process.env.EMAIL_FROM ?? "Movie Vault <no-reply@localhost>",
    ...email,
  });
}
