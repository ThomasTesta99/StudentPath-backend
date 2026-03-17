import express from "express"
import { getTeacherInformation } from "../../lib/utils";
import { db } from "../../db";
import { terms } from "../../db/schema";
import { and, desc, eq } from "drizzle-orm";

export const teacherTermsRouter = express.Router();

teacherTermsRouter.get("/", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        }

        const schoolId = teacher.schoolId;

        const termsList = await db
            .select()
            .from(terms)
            .where(eq(terms.schoolId, schoolId)) 
            .orderBy(desc(terms.isActive))

        return res.status(200).json({data: termsList})
    } catch (error) {
        console.error("GET /teacher/terms error: ", error);
        return res.status(500).json({error: "There was an error getting the terms"});
    }
})