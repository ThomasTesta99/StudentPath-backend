import { doublePrecision, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { sections } from "./course";
import { schools } from "./school";
import { assignments, assignmentTypeEnum } from "./assignments";
import { timestamps } from "./timestamps";
import { index } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { studentProfiles } from "./profiles";

// export const gradebookSettings = pgTable("gradebook_settings", {
//     id: text().primaryKey(),
//     sectionId: text().notNull().references(() => sections.id, {onDelete: "cascade"}), 

// })

export const gradeStatusEnum = pgEnum("grade_status", ["UNGRADED", "GRADED", "MISSING", "EXCUSED", "LATE", "INCOMPLETE"]);

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

export const assignmentGrades = pgTable("assignment_grades", {
    id: text().primaryKey(), 
    assignmentId: text().notNull().references(() => assignments.id, {onDelete: "cascade"}), 
    studentId: text().notNull().references(() => studentProfiles.userId, {onDelete: "cascade"}),
    score: doublePrecision(), 
    status: gradeStatusEnum("status").notNull().default("UNGRADED"), 
    comment: text(), 
    ...timestamps,
}, (table) => [
    index("assignment_grades_assignment_id").on(table.assignmentId), 
    index("assignment_grades_student_id").on(table.studentId),
    uniqueIndex("assignment_grades_assignment_id_student_id_unique").on(table.assignmentId, table.studentId)
])