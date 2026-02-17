import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { timestamps } from "./timestamps";

export const schools = pgTable("schools", {
    id: text("id").primaryKey(),
    schoolName: text("school_name").notNull(),
    ...timestamps
});

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

export type Terms = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;