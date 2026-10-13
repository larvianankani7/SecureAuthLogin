import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { authenticate } from "../../plugins/authenticate.js";

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const authUser = request.authUser!;

      const [user] = await db
        .select({
          publicId: users.publicId,
          email: users.email,
          username: users.username,
          role: users.role,
          createdAt: users.createdAt,
          emailVerifiedAt: users.emailVerifiedAt
        })
        .from(users)
        .where(eq(users.id, authUser.id))
        .limit(1);

      if (!user) {
        return reply.code(404).send({
          message: "Account not found."
        });
      }

      return reply.send({
        user: {
          id: user.publicId,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          emailVerifiedAt: user.emailVerifiedAt
        }
      });
    }
  );

  app.patch<{ Body: { username?: string } }>(
    "/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const username = request.body?.username?.trim() ?? "";

      if (username.length < 2 || username.length > 32) {
        return reply.code(400).send({
          message: "Username must contain between 2 and 32 characters."
        });
      }

      const [user] = await db
        .update(users)
        .set({ username })
        .where(eq(users.id, request.authUser!.id))
        .returning({
          publicId: users.publicId,
          email: users.email,
          username: users.username,
          role: users.role,
          createdAt: users.createdAt
        });

      if (!user) {
        return reply.code(404).send({
          message: "Account not found."
        });
      }

      return reply.send({
        message: "Settings updated.",
        user: {
          id: user.publicId,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt
        }
      });
    }
  );
}