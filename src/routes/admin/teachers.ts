import express from "express"
import { enrollments, NewTeacherProfile, schools, teacherProfiles, user } from "../../db/schema";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

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
            return res.status(400).json({error: "User not found or is not a teacher"});
        }

        // const schoolResult = await db
        //     .select({id: schools.id})
        //     .from(schools)
        //     .where(eq(schools.id, schoolId))
        //     .limit(1);

        // if(!schoolResult[0]){
        //     return res.status(400).json({error: "School not found"})
        // }

        // const [existing] = await db
        //     .select({id: teacherProfiles.userId})
        //     .from(teacherProfiles)
        //     .where(and(eq(teacherProfiles.userId, userId), eq(teacherProfiles.schoolId, schoolId)))
        //     .limit(1);

        // if(existing){
        //     return res.status(409).json({error: "Teacher profile already exists"});
        // }

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

adminTeacherRouter.get("/", async (req, res) => {
    try {
        const {search, page = 1, limit = 10, schoolId} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        filterConditions.push(eq(user.role, "teacher"));

        if(schoolId){
            filterConditions.push(eq(teacherProfiles.schoolId, String(schoolId)));
        }

        if(search){
            const s = String(search).trim();
            if(s.length > 0){
                filterConditions.push(
                    or(
                        ilike(user.name, `%${s}%`),
                        ilike(user.email, `%${s}%`),
                    )
                )
            }
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(teacherProfiles)
            .innerJoin(user, eq(teacherProfiles.userId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const teachers = await db
            .select({
                ...getTableColumns(teacherProfiles),
                user: {
                    ...getTableColumns(user),
                }
            })
            .from(teacherProfiles)
            .innerJoin(user, eq(teacherProfiles.userId, user.id))
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(teacherProfiles.createdAt));

        return res.status(200).json({
            data: teachers,
            pagination: {
                page: currentPage, 
                limit: limitPerPage, 
                total: totalCount, 
                totalPages: Math.ceil(totalCount / limitPerPage)
            },
        });
    } catch (error) {
        console.error("GET /teacherProfiles error: ", error);
        return res.status(500).json({error: "There was an error getting all the teachers"});
    }
})

adminTeacherRouter.get("/:id", async (req, res) => {
    try {
        const {id: userId} = req.params;

        const userResult = await db 
            .select({
                ...getTableColumns(teacherProfiles),
                user: {
                    ...getTableColumns(user)
                },
                school: {
                    ...getTableColumns(schools)
                }
            })
            .from(teacherProfiles)
            .innerJoin(user, eq(teacherProfiles.userId, user.id))
            .innerJoin(schools, eq(teacherProfiles.schoolId, schools.id))
            .where(and(eq(teacherProfiles.userId, userId), eq(user.role, "teacher")))
            .orderBy(desc(teacherProfiles.createdAt))

        if(userResult.length === 0){
            return res.status(404).json({error: "No user found"});
        }

        return res.status(200).json({
            data: userResult,
        })

    } catch (error) {
        console.error("GET /teacher profile error: ", error);
        return res.status(500).json({error: "There was an error getting the teacher profile"});
    }
})

adminTeacherRouter.delete("/:id/:schoolId", async (req, res) => {
    try {
        const {id, schoolId} = req.params;

        const result = await db
            .delete(teacherProfiles)
            .where(and(eq(teacherProfiles.userId, id), eq(teacherProfiles.schoolId, schoolId)));

        if(result.rowCount === 0){
            return res.status(404).json({error: "No teacher profile found"});
        }

        return res.status(200).json({message: 'Teacher profile removed'});

    } catch (error) {
        console.error("DELETE /teacher profiles error: ", error);
        return res.status(500).json({error: "There was an error removing this user as a teacher"});
    }
})