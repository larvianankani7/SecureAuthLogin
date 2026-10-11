import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { env } from "./config/env.js";
import { checkDatabase } from "./db/client.js";
import { redis } from "./db/redis.js";
import { authRoutes } from "./modules/auth/routes.js";
import { usersRoutes } from "./modules/users/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: false,
    bodyLimit: 16 * 1024
  });

  app.decorateRequest("authUser", null);

  app.register(helmet);

  app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  });

  app.register(cookie);

  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "access_token",
      signed: false
    }
  });

  app.addHook("onRequest", async (request, reply) => {
    const mutating = ["POST", "PATCH", "PUT", "DELETE"].includes(
      request.method
    );
    const origin = request.headers.origin;

    if (mutating && origin && origin !== env.FRONTEND_URL) {
      return reply.code(403).send({ message: "Origin not allowed." });
    }
  });

  
    app.setErrorHandler((error, request, reply) => {
        request.log.error({ err: error }, "Request failed");

        const err = error instanceof Error ? error : new Error("Unknown error");

        const status =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

        return reply.code(status).send({
            message: status >= 500 ? "Internal server error." : err.message
        });
    });

  app.get("/health", async (_request, reply) => {
    try {
      await checkDatabase();
      await redis.ping();

      return { status: "ok", database: "ok", redis: "ok" };
    } catch {
      return reply.code(503).send({
        status: "unavailable",
        message: "A required service is unavailable."
      });
    }
  });

  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(usersRoutes, { prefix: "/api/users" });
  app.register(adminRoutes, { prefix: "/api/admin" });

  return app;
}