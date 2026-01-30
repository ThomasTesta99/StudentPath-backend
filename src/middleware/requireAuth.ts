import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import { db } from "../db";
import {  user } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppRole } from "../types/express";
import { fromNodeHeaders } from "better-auth/node";

const isAppRole = (value: AppRole) => {
  return value === "student" || value === "teacher" || value === "admin" || value === "parent";
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({headers: fromNodeHeaders(req.headers)});
        const userId = session?.user?.id;

        if(!userId){
            res.status(401).json({message: "Unauthenticated"});
            return;
        }

        const email = session.user.email ?? null;

        const rows = await db
            .select({ role: user.role, email: user.email })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

        const row = rows[0];
        if (!row) return res.status(401).json({ message: "User not found" });
        
        req.user = { id: userId, email: row.email, role: row.role };
        next();
    } catch (error) {
        console.error("Auth check failed: ", error);
        res.status(500).json({message: "Auth check failed"});
    }
}