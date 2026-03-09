CREATE TYPE "public"."bell_schedule_type" AS ENUM('regular', 'early_dismissal', 'late_start', 'testing', 'assembly', 'custom');--> statement-breakpoint
CREATE TABLE "bell_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "bell_schedule_type" DEFAULT 'regular' NOT NULL,
	"day_start_time" time NOT NULL,
	"day_end_time" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY NOT NULL,
	"bell_schedule_id" text NOT NULL,
	"number" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"term_id" text NOT NULL,
	"course_id" text NOT NULL,
	"period_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"capacity" integer NOT NULL,
	"room_number" text,
	"section_label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_term_id_terms_id_fk";
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_teacher_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "courses_term_id_idx";--> statement-breakpoint
DROP INDEX "courses_teacher_id_idx";--> statement-breakpoint
DROP INDEX "courses_teacher_term_idx";--> statement-breakpoint
DROP INDEX "courses_school_term_idx";--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "grade_level" SET DATA TYPE "public"."grade_level" USING "grade_level"::"public"."grade_level";--> statement-breakpoint
ALTER TABLE "bell_schedules" ADD CONSTRAINT "bell_schedules_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_bell_schedule_id_bell_schedules_id_fk" FOREIGN KEY ("bell_schedule_id") REFERENCES "public"."bell_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bell_schedules_school_id_unique" ON "bell_schedules" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "periods_bell_schedule_id_idx" ON "periods" USING btree ("bell_schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "periods_bell_schedule_number_uq" ON "periods" USING btree ("bell_schedule_id","number");--> statement-breakpoint
CREATE INDEX "sections_school_id_idx" ON "sections" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sections_school_term_id_idx" ON "sections" USING btree ("school_id","term_id");--> statement-breakpoint
CREATE INDEX "sections_term_id_idx" ON "sections" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "sections_teacher_term_idx" ON "sections" USING btree ("teacher_id","term_id");--> statement-breakpoint
CREATE INDEX "sections_course_term_idx" ON "sections" USING btree ("course_id","term_id");--> statement-breakpoint
CREATE INDEX "sections_period_id_idx" ON "sections" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_school_term_teacher_period_uq" ON "sections" USING btree ("school_id","term_id","teacher_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_school_code_uq" ON "courses" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_school_name_uq" ON "courses" USING btree ("school_id","name");--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "term_id";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "teacher_id";