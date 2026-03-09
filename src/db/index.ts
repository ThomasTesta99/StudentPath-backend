import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if(!process.env.DATABASE_URL){
    throw new Error("Database URL not defined");
}

neonConfig.webSocketConstructor = ws;

export const db = drizzle(process.env.DATABASE_URL);