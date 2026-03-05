import { boolean, index, integer, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./timestamps";

export const gradeLevelEnum = pgEnum("grade_level", [
    "6", "7", "8", "9", "10", "11", "12",
]);

export const bellScheduleTypeEnum = pgEnum("bell_schedule_type", [
    "regular",
    "early_dismissal",
    "late_start",
    "testing",
    "assembly",
    "custom",
])

export const schools = pgTable("schools", {
    id: text("id").primaryKey(),
    schoolName: text("school_name").notNull(),
    ...timestamps
});

export const schoolGradeLevels = pgTable("school_grade_levels", {
    id: text("id").primaryKey(),  
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}),
    gradeLevel: gradeLevelEnum("grade_level").notNull(),
    ...timestamps, 
}, 
    (table) => [
        index("school_grade_levels_school_id_idx").on(table.schoolId), 
        uniqueIndex("school_grade_levels_school_grade_uq").on(table.schoolId, table.gradeLevel)
    ]
);

export const bellSchedules = pgTable("bell_schedules", {
    id: text("id").primaryKey(), 
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}), 
    name: text("name").notNull(),
    type: bellScheduleTypeEnum("type").notNull().default("regular"), 
    dayStartTime: time("day_start_time").notNull(), 
    dayEndTime:  time("day_end_time").notNull(),
    ...timestamps
}, 
    (table) => [
        uniqueIndex("bell_schedules_school_id_unique").on(table.schoolId),
    ]
);

export const periods = pgTable("periods", {
    id: text("id").primaryKey(), 
    schoolId: text("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
    bellScheduleId: text("bell_schedule_id").notNull().references(() => bellSchedules.id, {onDelete: 'cascade'}),
    number: integer("number").notNull(), 
    startTime: time("start_time").notNull(), 
    endTime: time("end_time").notNull(), 
    ...timestamps,
},
    (table) => [
        index("period_school_id_idx").on(table.schoolId), 
        index("periods_bell_schedule_id_idx").on(table.bellScheduleId), 
        uniqueIndex("periods_bell_schedule_number_uq").on(table.number),
        index("periods_school_schedule_idx").on(table.schoolId, table.bellScheduleId),
    ]
)

export const terms = pgTable("terms", {
    id: text("id").primaryKey(), 
    schoolId: text("school_id").notNull().references(() => schools.id, {onDelete: "cascade"}), 
    termName: text("term_name").notNull(),
    startDate: timestamp("start_date").notNull(), 
    endDate: timestamp("end_date").notNull(), 
    isActive: boolean("is_active").notNull().default(false),
    ...timestamps,
},
    (table) => ([
        index("terms_school_id_idx").on(table.schoolId),
        index("terms_school_id_is_active_idx").on(table.schoolId, table.isActive),
    ])
);

export type School = typeof schools.$inferSelect;
export type NewSchool = typeof schools.$inferInsert;

export type SchoolGradeLevel = typeof schoolGradeLevels.$inferSelect;
export type NewSchoolGradeLevel = typeof schoolGradeLevels.$inferInsert;

export type BellSchedule = typeof bellSchedules.$inferSelect;
export type NewBellSchedule = typeof bellSchedules.$inferInsert;

export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;

export type Terms = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;