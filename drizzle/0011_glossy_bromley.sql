ALTER TABLE "departments" ADD COLUMN "school_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_school_name_unique" ON "departments" USING btree ("school_id","name");--> statement-breakpoint
CREATE INDEX "departments_school_id_idx" ON "departments" USING btree ("school_id");