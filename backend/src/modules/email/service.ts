
import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

export async function sendOtpEmail(
  email: string,
  code: string
): Promise<void> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Your SecureAuthLogin verification code",
    text: [
      "Your email verification code is:",
      code,
      `This code expires in ${env.OTP_TTL_SECONDS} seconds.`,
      "Do not share this code with anyone."
    ].join("\n")
  });
}

export function getAccountDeletedEmailContent() {
  return {
    subject: "Account Deleted",
    body: [
      "Account Deleted",
      "Your SecureAuthLogin account has been deleted by an administrator.",
      "The action followed the detection or review of unusual account activity.",
      "Your account access and active sessions have been revoked.",
      "Your email address is blocked from registering another account.",
      "If you believe this action was taken in error, contact the project administrator.",
      "Please do not repeat activity that violates the application's rules."
    ].join("\n")
  };
}

export async function processEmailOutbox(): Promise<void> {
  const { db } = await import("../../db/client.js");
  const { emailOutbox } = await import("../../db/schema.js");
  const { eq, lt } = await import("drizzle-orm");

  const pending = await db
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.status, "pending"))
    .limit(10);

  for (const email of pending) {
    try {
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email.toEmail,
        subject: email.subject,
        text: email.body
      });
      await db
        .update(emailOutbox)
        .set({ status: "sent" })
        .where(eq(emailOutbox.id, email.id));
    } catch (error) {
      await db
        .update(emailOutbox)
        .set({ attempts: email.attempts + 1, status: email.attempts >= 4 ? "failed" : "pending" })
        .where(eq(emailOutbox.id, email.id));
    }
  }
}