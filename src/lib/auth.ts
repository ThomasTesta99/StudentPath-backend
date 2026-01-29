import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";// your drizzle instance
import { db } from "../db";
import * as schema from '../db/schema/auth'


const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
const frontendUrl = process.env.FRONTEND_URL;
if (!betterAuthSecret || !frontendUrl) {
    throw new Error("BETTER_AUTH_SECRET and FRONTEND_URL must be set");
}


export const auth = betterAuth({
    secret: process.env.betterAuthSecret, 
    trustedOrigins: [frontendUrl], 
    database: drizzleAdapter(db, {
        provider: "pg", 
        schema
    }),
    emailAndPassword: {
        enabled: true, 
    }
})