
import "dotenv/config";
import Fastify from "fastify";
import nodemailer from "nodemailer";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";

const required = [
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "EMAIL_RELAY_API_KEY"
];

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
}

const apiKey = process.env.EMAIL_RELAY_API_KEY;
const app = Fastify({ logger: true, bodyLimit: 8192 });

await app.register(rateLimit, {
  max: 10,
  timeWindow: "1 minute"
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { minVersion: "TLSv1.2" },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

function validApiKey(candidate) {
  if (typeof candidate !== "string") return false;

  const expected = Buffer.from(apiKey);
  const received = Buffer.from(candidate);

  return expected.length === received.length &&
    timingSafeEqual(expected, received);
}

app.get("/health", async () => ({
  status: "ok",
  service: "secureauthlogin-email-relay"
}));

app.post(
  "/internal/send-revocation",
  {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute"
      }
    }
  },
  async (request, reply) => {
    const authorization = request.headers.authorization ?? "";
    const suppliedKey = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!validApiKey(suppliedKey)) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const body = request.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return reply.code(400).send({ message: "Invalid request body" });
    }

    const { toEmail, outboxId, subject, text } = body;

    if (
      typeof toEmail !== "string" ||
      toEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail) ||
      typeof outboxId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outboxId) ||
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.length > 254 ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 6000
    ) {
      return reply.code(400).send({ message: "Invalid email payload" });
    }

    try {
      const result = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: toEmail,
        subject,
        text,
        messageId: `<${outboxId}@secureauthlogin.local>`
      });

      if (!result.accepted?.length) {
        throw new Error("SMTP did not accept the recipient");
      }

      request.log.info({
        event: "revocation_email_accepted_by_smtp",
        outboxId,
        messageId: result.messageId
      });

      return { accepted: true, outboxId };
    } catch (error) {
      request.log.error({
        event: "revocation_email_smtp_failed",
        outboxId,
        error: error instanceof Error ? error.message : "Unknown error"
      });

      return reply.code(502).send({
        message: "SMTP delivery failed",
        outboxId
      });
    }
  }
);

try {
  await transporter.verify();
  app.log.info("SMTP connection verified");

  await app.listen({
    port: Number(process.env.PORT ?? 8787),
    host: "127.0.0.1"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}