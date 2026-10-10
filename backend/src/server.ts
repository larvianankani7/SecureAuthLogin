
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDatabase, closeDatabase } from "./db/client.js";
import { ensureAdminAccount } from "./db/bootstrap.js";
import { redis } from "./db/redis.js";

async function main(): Promise<void> {
  const app = buildApp();

  try {
    await redis.connect();
    await checkDatabase();
    await ensureAdminAccount();

    await app.listen({
      port: env.PORT,
      host: env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"
    });

    app.log.info(`SecureAuthLogin API listening on port ${env.PORT}`);
  } catch (error) {
    app.log.error({ err: error }, "Server startup failed");
    await app.close().catch(() => undefined);

    if (redis.isOpen) {
      await redis.quit().catch(() => undefined);
    }

    await closeDatabase().catch(() => undefined);
    process.exitCode = 1;
  }

  const shutdown = async () => {
    await app.close().catch(() => undefined);

    if (redis.isOpen) {
      await redis.quit().catch(() => undefined);
    }

    await closeDatabase().catch(() => undefined);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void main();