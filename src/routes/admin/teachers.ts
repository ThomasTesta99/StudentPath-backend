import express from "express"
import { NewTeacherProfile, teacherProfiles, user } from "../../db/schema";
import { db } from "../../db";
import { and, eq } from "drizzle-orm";

export const adminTeacherRouter =express.Router();

adminTeacherRouter.post("/", async (req, res) => {
    try {
        const {userId, schoolId} = req.body;

        if(!userId || !schoolId){
            return res.status(400).json({error: "UserId and SchoolId required"});
        }

        const userResult = await db
            .select({id: user.id})
            .from(user)
            .where(and(eq(user.id, userId), eq(user.role, "teacher")))
            .limit(1);

        if(!userResult[0]){
            return res.status(400).json({error: "No user found"});
        }

        const [existing] = await db
            .select({id: teacherProfiles.userId})
            .from(teacherProfiles)
            .where(eq(teacherProfiles.userId, userId))
            .limit(1);

        if(existing){
            return res.status(409).json({error: "Teacher profile already exists"});
        }

        const newTeacher: NewTeacherProfile = {
            userId, 
            schoolId, 
        }

        const [teacherResult] = await db
            .insert(teacherProfiles)
            .values(newTeacher)
            .returning();

        return res.status(201).json({data: teacherResult})
    } catch (error) {
        console.error("POST /admin/teacher error: ", error);
        return res.status(500).json({error: "There was an error creating the teacher"});
    }
})