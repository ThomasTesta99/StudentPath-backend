DROP TABLE "app_user" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "profile_role" "profile_role" DEFAULT 'student' NOT NULL;