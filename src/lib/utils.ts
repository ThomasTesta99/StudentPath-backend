import { eq } from "drizzle-orm";
import { db } from "../db";
import { adminProfiles } from "../db/schema";
import { auth } from "./auth";
import { Request } from "express";
import { GradeLevel } from "../routes/admin/schools";

export const getSchoolIdForAdmin = async (req: Request) => {
    try {
        const session = await auth.api.getSession({headers: req.headers});
        if(!session?.user?.id){
            console.error("No valid session");
            return;
        }

        const userId = session.user.id;

        const [schoolId] = await db
            .select({schoolId: adminProfiles.schoolId})
            .from(adminProfiles)
            .where(eq(adminProfiles.userId, String(userId)))
            .limit(1);

        if(!schoolId){
            console.error("Invalid user");
            return;
        }
        return schoolId.schoolId;
    } catch (error) {
        console.error("There was an error getting the school", error);
    }
}

const ALLOWED_GRADE_LEVELS = new Set([
  "8","9","10","11","12",
]);

export function normalizeGradeLevels(gradeLevels: GradeLevel[]): GradeLevel[] {
  const out: GradeLevel[] = [];
  const seen = new Set<GradeLevel>();
  for (const g of gradeLevels) {
    if (!seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}
