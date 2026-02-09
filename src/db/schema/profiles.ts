import { date, index, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { schools } from "./school";
import { timestamps } from "./timestamps";

export const adminProfiles = pgTable(
  "admin_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    schoolId: text("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => ({
    schoolIdIdx: index("admin_profiles_school_id_idx").on(table.schoolId),
  })
);

export const teacherProfiles = pgTable("teacher_profiles", {
    userId: text("user_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}),
    ...timestamps
}, 
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.schoolId] }),
        schoolIdIdx: index("teacher_profiles_school_id_idx").on(table.schoolId)
    })
);

export const studentProfiles = pgTable("student_profiles", {
    userId: text("user_id").primaryKey().references(() => user.id, {onDelete: "cascade"}),
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}),
    osis: text("osis").notNull(), 
    dob: date("dob").notNull(), 
    gradeLevel: text("grade_level").notNull(),
    ...timestamps,
}, 
    (table) => ({
        schoolIdIdx: index("student_profile_school_id_idx").on(table.schoolId),
        osisLookupIdx: index("student_profiles_osis_idx").on(table.osis), 
        osisPerSchoolUnique: uniqueIndex("student_profiles_school_osis_unique").on(
            table.schoolId, 
            table.osis
        )
    })
);

export const parentProfiles = pgTable("parent_profile", {
    userId: text("user_id").primaryKey().references(() => user.id, {onDelete: "cascade"}),
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}),
    ...timestamps
},
    (table) => ({
        schoolIdIdx: index("parent_profiles_school_id_idx").on(table.schoolId)
    })
)

export const parentStudentLinks = pgTable("parent_student_links", {
    parentId: text("parent_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    studentId: text("student_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    ...timestamps
},
    (table) => ({
        pk: primaryKey({ columns: [table.parentId, table.studentId] }),
        parentIdIdx: index("parent_student_links_parent_id_idx").on(table.parentId),
        studentIdIdx: index("parent_student_links_student_id_idx").on(table.studentId),

    })
)

export type AdminProfile = typeof adminProfiles.$inferSelect;
export type NewAdminProfile = typeof adminProfiles.$inferInsert;

export type TeacherProfile = typeof teacherProfiles.$inferSelect;
export type NewTeacherProfile = typeof teacherProfiles.$inferInsert;

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type NewStudentProfile = typeof studentProfiles.$inferInsert;

export type ParentProfile = typeof parentProfiles.$inferSelect;
export type NewParentProfile = typeof parentProfiles.$inferInsert;

export type ParentStudentLink = typeof parentStudentLinks.$inferSelect;
export type NewParentStudentLink = typeof parentStudentLinks.$inferInsert;