import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";// your drizzle instance
import { db } from "../db";
import * as schema from '../db/schema/auth'


const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
const frontendUrl = process.env.FRONTEND_URL;
const baseUrl = process.env.BETTER_AUTH_BASE_URL;
if (!betterAuthSecret || !frontendUrl || !baseUrl) {
    throw new Error("BETTER_AUTH_SECRET,BETTER_AUTH_BASE_URL and FRONTEND_URL must be set");
}


export const auth = betterAuth({
    baseURL: baseUrl,
    secret: betterAuthSecret, 
    trustedOrigins: [frontendUrl], 
    database: drizzleAdapter(db, {
        provider: "pg", 
        schema
    }),
    emailAndPassword: {
        enabled: true, 
    },
    additionalFields: {
        role: {
            type: "enum", 
            required: true, 
            defaultValue: "student", 
            input: true,
        }
    }
})