import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  blockedEmails,
  emailOutbox,
  users
} from "../../db/schema.js";
import {
  authenticate,
  requireAdmin
} from "../../plugins/authenticate.js";
import {
  getAccountRevokedEmailContent,
  processEmailOutbox
} from "../email/service.js";

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/users",
    {
      preHandler: [authenticate, requireAdmin]
    },
    async () => {
      const result = await db
        .select({
          id: users.publicId,
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
    {
      preHandler: [authenticate, requireAdmin]
    },
    async (request, reply) => {
      const publicId = request.params.userId;

      if (!/^[A-Za-z0-9_-]{43}$/.test(publicId)) {
        return reply.code(400).send({
          message: "Invalid user ID."
        });
      }

      const [target] = await db
        .select({
          id: users.id,
          publicId: users.publicId,
          email: users.email,
          role: users.role
        })
        .from(users)
        .where(eq(users.publicId, publicId))
        .limit(1);

      if (!target) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      if (target.id === request.authUser!.id) {
        return reply.code(400).send({
          message: "You cannot delete your own administrator account."
        });
      }

      if (target.role === "admin") {
        return reply.code(403).send({
          message:
            "Administrator accounts cannot be deleted through this endpoint."
        });
      }

      const emailContent = getAccountRevokedEmailContent();

      const outboxId = await db.transaction(async tx => {
        await tx
          .insert(blockedEmails)
          .values({
            email: target.email,
            reason: "admin_deletion",
            blockedAt: new Date()
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

        const [queued] = await tx
          .insert(emailOutbox)
          .values({
            toEmail: target.email,
            subject: emailContent.subject,
            body: emailContent.body
          })
          .returning({
            id: emailOutbox.id
          });

        return queued.id;
      });

      request.log.warn(
        {
          event: "account_revoked_by_admin",
          actorId: request.authUser!.id,
          targetPublicId: target.publicId,
          outboxId
        },
        "Account access revoked"
      );

      try {
        await processEmailOutbox(outboxId);
      } catch (error) {
        request.log.error(
          {
            event: "revocation_email_failed",
            outboxId,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error"
          },
          "Account was revoked but SMTP delivery failed"
        );

        return reply.code(200).send({
          message:
            "Account access was revoked and the email was queued, but SMTP delivery failed. Check the Render logs.",
          emailSent: false
        });
      }

      const [delivery] = await db
        .select({
          status: emailOutbox.status
        })
        .from(emailOutbox)
        .where(eq(emailOutbox.id, outboxId))
        .limit(1);

      return reply.code(200).send({
        message:
          delivery?.status === "sent"
            ? "Account access revoked and notification email sent."
            : "Account access revoked, but email delivery was not confirmed.",
        emailSent: delivery?.status === "sent"
      });
    }
  );
}