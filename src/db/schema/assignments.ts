import { date, doublePrecision, index, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { sections } from "./course";
import { timestamps } from "./timestamps";

export const assignmentTypeEnum = pgEnum("assignment_type", ["HOMEWORK", "QUIZ", "EXAM", "PROJECT", "CLASSWORK", "OTHER"]);

export const assignments = pgTable("assignments", {
    id: text("id").primaryKey(),
    sectionId: text("section_id").notNull().references(() => sections.id, {onDelete: "cascade"}),
    title: text("title").notNull(),
    description: text("description").notNull(), 
    dueDate: date("due_date").notNull(), 
    pointsPossible: doublePrecision("points_possible").notNull(), 
    type: assignmentTypeEnum("type").notNull(), 
    assignmentGroupId: text("assignment_group_id"), 
    ...timestamps
}, (table) => [
        index("assignments_section_id_idx").on(table.sectionId),
        index("assignments_section_due_date_idx").on(table.sectionId, table.dueDate),
        index("assignments_section_type_idx").on(table.sectionId, table.type),
        index("assignments_group_id_idx").on(table.assignmentGroupId)
    ]
);

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;