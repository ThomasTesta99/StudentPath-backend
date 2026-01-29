import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import { db } from "../db";
import { appUsers } from "../db/schema";
import { eq } from "drizzle-orm";
import { AppRole } from "../types/express";

const isAppRole = (value: AppRole) => {
  return value === "student" || value === "teacher" || value === "admin" || value === "parent";
};

export const requreAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({headers: await req.headers});
        const userId = session?.user?.id;

        if(!userId){
            res.status(401).json({message: "Unauthenticated"});
            return;
        }

        const email = session.user.email ?? null;

        const row = await db
            .select({role: appUsers.role})
            .from(appUsers)
            .where(eq(appUsers.userId, userId))
            .limit(1);

        if (!row[0]) {
            return res.status(403).json({ message: "Missing role mapping" });
        }

        const roleValue = row[0].role;
        if(!isAppRole(roleValue)) {
            return res.status(403).json({message: "Invalid role"});
        }

        req.user = {id: userId, email, role: roleValue};

        next();
    } catch (error) {
        res.status(500).json({error: error, message: "Auth check failed"});
    }
}