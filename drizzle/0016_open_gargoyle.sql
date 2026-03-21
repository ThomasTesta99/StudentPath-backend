CREATE TYPE "public"."assignment_type" AS ENUM('HOMEWORK', 'QUIZ', 'EXAM', 'PROJECT', 'CLASSWORK', 'OTHER');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"due_date" date NOT NULL,
	"points_possible" double precision NOT NULL,
	"type" "assignment_type" NOT NULL,
	"assignment_group_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_section_id_idx" ON "assignments" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "assignments_section_due_date_idx" ON "assignments" USING btree ("section_id","due_date");--> statement-breakpoint
CREATE INDEX "assignments_section_type_idx" ON "assignments" USING btree ("section_id","type");--> statement-breakpoint
CREATE INDEX "assignments_group_id_idx" ON "assignments" USING btree ("assignment_group_id");