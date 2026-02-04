import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
};

export const schools = pgTable("schools", {
    id: text("id").primaryKey(),
    schoolName: text("school_name").notNull(),
    ...timestamps
});

export const terms = pgTable("terms", {
    id: text(" id").primaryKey(), 
    schoolId: text("school_id").references(() => schools.id, {onDelete: "cascade"}), 
    termName: text("term_name"),
    startDate: timestamp("start_date").notNull(), 
    endDate: timestamp("end_date").notNull(), 
    isActive: boolean("is_active").default(false),
    ...timestamps
})