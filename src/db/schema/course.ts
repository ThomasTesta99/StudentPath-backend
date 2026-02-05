import { index, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { schools, terms } from "./school";
import { user } from "./auth";
import { timestamps } from "./timestamps";

export const departments = pgTable("departments", {
    id: text("id").primaryKey(), 
    name: text("name").notNull(),
    schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    ...timestamps
},
  (table) => ({
    schoolNameUnique: uniqueIndex("departments_school_name_unique").on(table.schoolId, table.name),
    schoolIdx: index("departments_school_id_idx").on(table.schoolId),
    nameIdx: index("departments_name_idx").on(table.name),
  })
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
  (table) => ({
    schoolIdIdx: index("courses_school_id_idx").on(table.schoolId),
    termIdIdx: index("courses_term_id_idx").on(table.termId),
    teacherIdIdx: index("courses_teacher_id_idx").on(table.teacherId),
    departmentIdIdx: index("courses_department_id_idx").on(table.departmentId),
    teacherTermIdx: index("courses_teacher_term_idx").on(table.teacherId, table.termId),
    schoolTermIdx: index("courses_school_term_idx").on(table.schoolId, table.termId),
    schoolGradeIdx: index("courses_school_grade_idx").on(table.schoolId, table.gradeLevel),
  })
);

export const enrollments = pgTable("enrollments", {
    courseId: text("course_id").notNull().references(() => courses.id, {onDelete: 'cascade'}), 
    studentId: text("student_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    ...timestamps
},
  (table) => ({
    pk: primaryKey({ columns: [table.courseId, table.studentId] }),
    courseIdIdx: index("enrollments_course_id_idx").on(table.courseId),
    studentIdIdx: index("enrollments_student_id_idx").on(table.studentId),
  })
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
