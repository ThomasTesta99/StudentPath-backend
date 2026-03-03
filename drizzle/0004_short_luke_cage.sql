ALTER TABLE "departments" ADD COLUMN "code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "parent_invites_token_hash_unique" ON "parent_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_school_code_unique" ON "departments" USING btree ("school_id","code");