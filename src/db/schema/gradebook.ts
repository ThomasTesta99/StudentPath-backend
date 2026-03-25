import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { sections } from "./course";
import { schools } from "./school";
import { assignmentTypeEnum } from "./assignments";
import { timestamps } from "./timestamps";
import { index } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

// export const gradebookSettings = pgTable("gradebook_settings", {
//     id: text().primaryKey(),
//     sectionId: text().notNull().references(() => sections.id, {onDelete: "cascade"}), 

// })

export const courseCategories = pgTable("course_categories", {
    id: text().primaryKey(),
    schoolId: text().notNull().references(() => schools.id, { onDelete: "cascade" }),
    sectionId: text().notNull().references(() => sections.id, { onDelete: "cascade" }),
    name: assignmentTypeEnum("name").notNull(),
    percentage: integer().notNull(),
    sortOrder: integer().notNull().default(0),
    ...timestamps
}, (table) => [
    index("course_categories_section_id").on(table.sectionId),
    index("course_categories_section_id_sort_order").on(table.sectionId, table.sortOrder),
    uniqueIndex("course_categories_section_id_name_unique").on(table.sectionId, table.name),
]);