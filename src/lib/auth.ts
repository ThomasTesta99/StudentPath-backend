import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";// your drizzle instance
import { db } from "../db";
import * as schema from '../db/schema/auth'

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!, 
    trustedOrigins: [process.env.FRONTEND_URL!], 
    database: drizzleAdapter(db, {
        provider: "pg", 
        schema
    }),
    emailAndPassword: {
        enabled: true, 
    }
})