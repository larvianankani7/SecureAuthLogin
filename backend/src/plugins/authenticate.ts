
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  sessionId: string;
};

type AccessPayload = {
  sub: string;
  sid: string;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const payload = await request.jwtVerify() as AccessPayload;

    if (!payload.sub || !payload.sid) {
      reply.code(401).send({ message: "Authentication required" });
      return;
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, payload.sid))
      .limit(1);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      reply.code(401).send({ message: "Session expired or revoked" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.emailVerifiedAt) {
      reply.code(401).send({ message: "Authentication required" });
      return;
    }

    request.authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id
    };
  } catch {
    reply.code(401).send({ message: "Authentication required" });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.authUser?.role !== "admin") {
    reply.code(403).send({ message: "Administrator access required" });
  }
}