import express from "express"
import { getSchoolIdForAdmin } from "../../lib/utils";
import { auth } from "../../lib/auth";
import { NewStudentProfile, studentProfiles, user } from "../../db/schema";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

export const adminStudentsRouter = express.Router();

adminStudentsRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {name, email, password, dob, gradeLevel, osis} = req.body;

        const osisString = String(osis ?? "").trim();
        if (!/^\d{9}$/.test(osisString)) {
            return res.status(400).json({ error: "osis must be exactly 9 digits (as a string)" });
        }

        const dobString = String(dob ?? "").trim();

        const existing = await db
            .select({userId: studentProfiles.userId})
            .from(studentProfiles)
            .where(and(eq(studentProfiles.schoolId, schoolId), eq(studentProfiles.osis, osisString)))
            .limit(1);

        if(existing.length > 0){
            return res.status(409).json({error: "A student with this OSIS already exists in this school"})
        }

        const result = await auth.api.signUpEmail({
            body: {
                name, 
                email, 
                password,
                role: "student"
            }
        })

        if(!result.user){
            return res.status(400).json({error: "There was an error signing up the user."})
        }

        const user = result.user;
        
        const newStudent: NewStudentProfile = {
            userId: user.id, 
            schoolId, 
            osis: osisString,
            dob: dobString, 
            gradeLevel, 
        }

        const [createdProfile] = await db
            .insert(studentProfiles)
            .values(newStudent)
            .returning();

        if(!createdProfile){
            return res.status(400).json({error: "There was an error creating a student profile"});
        }

        return res.status(201).json({user: user, profile: createdProfile});
    } catch (error) {
        console.error("POST /admin students error: ", error);
        return res.status(500).json({error: "There was an error creating the student"});
    }
})

adminStudentsRouter.get("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {search, page = 1, limit = 10, gradeLevel} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        filterConditions.push(eq(studentProfiles.schoolId, schoolId));

        if(search){
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`),
                    ilike(studentProfiles.osis, `%${search}%`),
                )
            )
        }

        if(gradeLevel){
            filterConditions.push(eq(studentProfiles.gradeLevel, String(gradeLevel)));
        }

        const whereClause = and(...filterConditions);

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(studentProfiles)
            .innerJoin(user, eq(studentProfiles.userId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const studentList = await db
            .select({
                ...getTableColumns(studentProfiles),
                user: {
                    ...getTableColumns(user)
                }
            })
            .from(studentProfiles)
            .innerJoin(user, eq(studentProfiles.userId, user.id))
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(studentProfiles.createdAt));

         return res.status(200).json({
            data: studentList,
            pagination: {
                page: currentPage, 
                limit: limitPerPage, 
                total: totalCount, 
                totalPages: Math.ceil(totalCount / limitPerPage)
            },
        });
    } catch (error) {
        console.error("GET /students error: ", error);
        return res.status(500).json({error: "There was an error getting students"});
    }
})