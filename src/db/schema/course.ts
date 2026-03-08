import { index, pgTable, primaryKey, text, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { gradeLevelEnum, periods, schools, terms } from "./school";
import { user } from "./auth";
import { timestamps } from "./timestamps";

export const departments = pgTable("departments", {
    id: text("id").primaryKey(), 
    name: text("name").notNull(),
    code: text("code").notNull(),
    schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    ...timestamps
},
  (table) => ([
    uniqueIndex("departments_school_name_unique").on(table.schoolId, table.name),
    uniqueIndex("departments_school_code_unique").on(table.schoolId, table.code), 
    index("departments_school_id_idx").on(table.schoolId),
    index("departments_name_idx").on(table.name),
  ])
)

export const courses = pgTable("courses", {
    id: text("id").primaryKey(), 
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}), 
    departmentId: text("department_id").notNull().references(() => departments.id, {onDelete: "restrict"}),
    name: text("name").notNull(), 
    gradeLevel: gradeLevelEnum("grade_level").notNull(), 
    code: text("code").notNull(), 
    description: text("description").notNull(), 
    ...timestamps
},
  (table) => ([
    index("courses_school_id_idx").on(table.schoolId),
    index("courses_department_id_idx").on(table.departmentId),
    index("courses_school_grade_idx").on(table.schoolId, table.gradeLevel),
    uniqueIndex("courses_school_code_uq").on(table.schoolId, table.code),
    uniqueIndex("courses_school_name_uq").on(table.schoolId, table.name)
  ])
);

export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}), 
  termId: text("term_id").notNull().references(() => terms.id, {onDelete: "cascade"}),
  courseId: text("course_id").notNull().references(() => courses.id, {onDelete: "cascade"}),
  periodId: text("period_id").notNull().references(() => periods.id, {onDelete: "restrict"}),
  teacherId: text("teacher_id").notNull().references(() => user.id, {onDelete: "restrict"}),
  capacity: integer("capacity").notNull(), 
  sectionLabel: text("section_label").notNull(),
  roomNumber: text("room_number"), 
  ...timestamps,
}, 
  (table) => [
    index("sections_school_id_idx").on(table.schoolId), 
    index("sections_school_term_id_idx").on(table.schoolId, table.termId),
    index("sections_term_id_idx").on(table.termId),
    index("sections_teacher_term_idx").on(table.teacherId, table.termId),
    index("sections_course_term_idx").on(table.courseId, table.termId),
    index("sections_period_id_idx").on(table.periodId),
    uniqueIndex("sections_school_term_teacher_period_uq").on(
      table.schoolId,
      table.termId,
      table.teacherId,
      table.periodId,
    ),
    uniqueIndex("sections_school_term_course_label_uq").on(
      table.schoolId,
      table.termId,
      table.courseId,
      table.sectionLabel,
    ),
  ]
)

export const enrollments = pgTable("enrollments", {
    sectionId: text("section_id").notNull().references(() => sections.id, {onDelete: 'cascade'}), 
    studentId: text("student_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    ...timestamps
},
  (table) => ([
    primaryKey({ columns: [table.sectionId, table.studentId] }),
    index("enrollments_section_id_idx").on(table.sectionId),
    index("enrollments_student_id_idx").on(table.studentId),
  ])
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;


export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
