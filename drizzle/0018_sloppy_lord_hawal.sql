CREATE TYPE "public"."grade_status" AS ENUM('UNGRADED', 'GRADED', 'MISSING', 'EXCUSED', 'LATE', 'INCOMPLETE');--> statement-breakpoint
CREATE TABLE "assignment_grades" (
	"id" text PRIMARY KEY NOT NULL,
	"assignmentId" text NOT NULL,
	"sectionId" text NOT NULL,
	"studentId" text NOT NULL,
	"score" double precision,
	"status" "grade_status" DEFAULT 'UNGRADED' NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "course_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"schoolId" text NOT NULL,
	"sectionId" text NOT NULL,
	"name" "assignment_type" NOT NULL,
	"percentage" integer NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_assignmentId_assignments_id_fk" FOREIGN KEY ("assignmentId") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_sectionId_sections_id_fk" FOREIGN KEY ("sectionId") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_studentId_student_profiles_user_id_fk" FOREIGN KEY ("studentId") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_schoolId_schools_id_fk" FOREIGN KEY ("schoolId") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_sectionId_sections_id_fk" FOREIGN KEY ("sectionId") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_categories_section_id" ON "course_categories" USING btree ("sectionId");--> statement-breakpoint
CREATE INDEX "course_categories_section_id_sort_order" ON "course_categories" USING btree ("sectionId","sortOrder");--> statement-breakpoint
CREATE UNIQUE INDEX "course_categories_section_id_name_unique" ON "course_categories" USING btree ("sectionId","name");