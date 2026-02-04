import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
};

export const schools = pgTable("schools", {
    schoolId: text("school_id").primaryKey(),
    schoolName: text("school_name").notNull(),
    ...timestamps
})