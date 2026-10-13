ALTER TABLE "users" ADD COLUMN "public_id" varchar(43) NOT NULL;--> statement-breakpoint
CREATE INDEX "users_public_id_idx" ON "users" USING btree ("public_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_public_id_unique" UNIQUE("public_id");