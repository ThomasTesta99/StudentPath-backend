import { index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { schools, terms } from "./school";
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
    termId: text("term_id").notNull().references(() => terms.id, {onDelete: "cascade"}),
    teacherId: text("teacher_id").notNull().references(() => user.id, {onDelete: "restrict"}),
    name: text("name").notNull(), 
    gradeLevel: text("grade_level").notNull(), 
    departmentId: text("department_id").notNull().references(() => departments.id, {onDelete: "restrict"}),
    code: text("code").notNull(), 
    description: text("description").notNull(), 
    ...timestamps
},
  (table) => ([
    index("courses_school_id_idx").on(table.schoolId),
    index("courses_term_id_idx").on(table.termId),
    index("courses_teacher_id_idx").on(table.teacherId),
    index("courses_department_id_idx").on(table.departmentId),
    index("courses_teacher_term_idx").on(table.teacherId, table.termId),
    index("courses_school_term_idx").on(table.schoolId, table.termId),
    index("courses_school_grade_idx").on(table.schoolId, table.gradeLevel),
  ])
);

export const enrollments = pgTable("enrollments", {
    courseId: text("course_id").notNull().references(() => courses.id, {onDelete: 'cascade'}), 
    studentId: text("student_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    ...timestamps
},
  (table) => ([
    primaryKey({ columns: [table.courseId, table.studentId] }),
    index("enrollments_course_id_idx").on(table.courseId),
    index("enrollments_student_id_idx").on(table.studentId),
  ])
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
