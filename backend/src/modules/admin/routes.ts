import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  blockedEmails,
  users,
  emailOutbox
} from "../../db/schema.js";
import {
  authenticate,
  requireAdmin
} from "../../plugins/authenticate.js";
import {
  getAccountDeletedEmailContent,
  processEmailOutbox
} from "../email/service.js";

export async function adminRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get(
    "/users",
    { preHandler: [authenticate, requireAdmin] },
    async () => {
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          role: users.role,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.role, "user"))
        .orderBy(desc(users.createdAt))
        .limit(100);

      return { users: result };
    }
  );

  app.delete<{ Params: { userId: string } }>(
    "/users/:userId",
    { preHandler: [authenticate, requireAdmin] },
    async (request, reply) => {
      const userId = request.params.userId;

      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          userId
        )
      ) {
        return reply.code(400).send({
          message: "Invalid user ID."
        });
      }

      if (userId === request.authUser!.id) {
        return reply.code(400).send({
          message:
            "You cannot delete your own administrator account."
        });
      }

      const [target] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!target) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      if (target.role === "admin") {
        return reply.code(403).send({
          message:
            "Administrator accounts cannot be deleted through this endpoint."
        });
      }

      // Delete the account and queue its notification atomically.
      const outboxId = await db.transaction(async (tx) => {
        await tx
          .insert(blockedEmails)
          .values({
            email: target.email,
            reason: "admin_deletion"
          })
          .onConflictDoUpdate({
            target: blockedEmails.email,
            set: {
              reason: "admin_deletion",
              blockedAt: new Date()
            }
          });

        await tx
          .delete(users)
          .where(eq(users.id, target.id));

        const emailContent = getAccountDeletedEmailContent();

        const [queuedEmail] = await tx
          .insert(emailOutbox)
          .values({
            toEmail: target.email,
            subject: emailContent.subject,
            body: emailContent.body
          })
          .returning({
            id: emailOutbox.id
          });

        return queuedEmail.id;
      });

      // Wait for the outbox processor, then inspect the real status.
      try {
        await processEmailOutbox();
      } catch (error) {
        request.log.error(
          { err: error, outboxId },
          "Account deletion email processing failed"
        );
      }

      const [delivery] = await db
        .select({
          status: emailOutbox.status,
          attempts: emailOutbox.attempts
        })
        .from(emailOutbox)
        .where(eq(emailOutbox.id, outboxId))
        .limit(1);

      if (delivery?.status === "sent") {
        return reply.send({
          message:
            "Account deleted, access revoked, and email notification sent.",
          emailSent: true
        });
      }

      request.log.error(
        {
          outboxId,
          emailStatus: delivery?.status ?? "unknown",
          attempts: delivery?.attempts ?? 0,
          recipient: target.email
        },
        "Account was revoked, but email delivery was not confirmed"
      );

      return reply.code(200).send({
        message:
          "Account deleted and access revoked, but the email notification could not be confirmed as sent. Check the email provider and server logs.",
        emailSent: false
      });
    }
  );
}