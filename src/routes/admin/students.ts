import express from "express"
import { getSchoolIdForAdmin } from "../../lib/utils";
import { auth } from "../../lib/auth";
import { NewStudentProfile, parentProfiles, parentStudentLinks, schools, StudentProfile, studentProfiles, User, user } from "../../db/schema";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, ne, or, sql } from "drizzle-orm";

export const adminStudentsRouter = express.Router();

adminStudentsRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {name, email, password, dob, gradeLevel, osis} = req.body;

        if (!name || typeof name !== "string") {
            return res.status(400).json({ error: "name is required" });
        }
        if (!email || typeof email !== "string") {
            return res.status(400).json({ error: "email is required" });
        }
        if (!password || typeof password !== "string") {
            return res.status(400).json({ error: "password is required" });
        }

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

        const result = await auth.api.createUser({
            body: {
                name, 
                email, 
                password,
                role: "user",
                data: {profileRole: "student"}
            }
        })

        if(!result.user){
            return res.status(400).json({error: "There was an error signing up the user."})
        }

        const createdUser = result.user;
        
        const newStudent: NewStudentProfile = {
            userId: createdUser.id, 
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
            await auth.api.removeUser({
                body: {userId: createdUser.id}, 
                headers: req.rawHeaders,
            })
            return res.status(400).json({error: "There was an error creating a student profile"});
        }

        return res.status(201).json({data: {user: createdUser, profile: createdProfile}});
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
                },
                school: {
                    schoolName: schools.schoolName
                }
            })
            .from(studentProfiles)
            .innerJoin(user, eq(studentProfiles.userId, user.id))
            .innerJoin(schools, eq(studentProfiles.schoolId, schools.id))
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

adminStudentsRouter.get("/parents", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {studentId} = req.query;

        const parentList = await db
            .select({
                ...getTableColumns(parentStudentLinks), 
                user: {
                    ...getTableColumns(user)
                }
            })
            .from(parentStudentLinks)
            .innerJoin(parentProfiles, eq(parentProfiles.userId, parentStudentLinks.parentId))
            .innerJoin(user, eq(parentProfiles.userId, user.id))
            .where(
                and(
                    eq(parentProfiles.schoolId, schoolId), 
                    eq(parentStudentLinks.studentId, String(studentId))
                ) 
            );

        return res.status(200).json({
            data: parentList, 
            pagination: {
                total: parentList.length
            }
        })
    } catch (error) {
        console.error("GET /parents/student error: ", error);
        return res.status(500).json({error: "There was an error getting the parents"}); 
    }
})

adminStudentsRouter.get("/:userId", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        
        const {userId} = req.params;

        const [student] = await db
            .select({
                ...getTableColumns(studentProfiles),
                user: {
                    ...getTableColumns(user)
                },
                school: {
                    schoolName: schools.schoolName
                }
            })
            .from(studentProfiles)
            .innerJoin(user, eq(studentProfiles.userId,user.id))
            .innerJoin(schools, eq(studentProfiles.schoolId, schoolId))
            .where(and(eq(studentProfiles.userId, userId), eq(studentProfiles.schoolId, schoolId)))
            .limit(1);

        if(!student){
            return res.status(404).json({error: "Student not found"});
        }

        return res.status(200).json({data: student});
    } catch (error) {
       console.error("GET /students error: ", error);
       return res.status(500).json({error: "There was an error getting the student"}); 
    }
})


adminStudentsRouter.patch("/:userId", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {userId} = req.params;
        const {name, email, gradeLevel, dob, osis} = req.body;

        const profileUpdates: Partial<StudentProfile> = {};
        const userUpdates: Partial<User> = {};
        
        if(typeof name === "string" && name.trim().length > 0) userUpdates.name = name;
        if(typeof email === "string" && email.trim().length > 0) userUpdates.name = email;
        if(typeof gradeLevel === "string" && gradeLevel.trim().length > 0) profileUpdates.gradeLevel = gradeLevel.trim();
        if(typeof dob === "string" && dob.trim().length > 0){
            const d = new Date(dob);
            if (Number.isNaN(d.getTime())) {
                return res.status(400).json({ error: "dob must be a valid date" });
            }
            profileUpdates.dob = dob.trim();
        }
        if(typeof osis === "string" && osis.trim().length > 0) {
            if (!/^\d{9}$/.test(osis.trim())) {
                return res.status(400).json({ error: "osis must be exactly 9 digits" });
            }
            profileUpdates.osis = osis.trim();
        }

        if(profileUpdates.osis){
            const existingOsis = await db
                .select({count: sql<number>`count(*)`})
                .from(studentProfiles)
                .where(and(eq(studentProfiles.schoolId, schoolId), eq(studentProfiles.osis, profileUpdates.osis), ne(studentProfiles.userId, userId)));
            
            if(existingOsis[0]?.count && existingOsis[0]?.count > 0){
                return res.status(400).json({error: "OSIS already asigned to a student"});
            }
        }

        if (
            Object.keys(profileUpdates).length === 0 &&
            Object.keys(userUpdates).length === 0
        ) {
            return res.status(400).json({ error: "No valid fields provided" });
        }

        let updatedProfile = null;
        let updatedUser = null;

        if (Object.keys(profileUpdates).length > 0) {
            [updatedProfile] = await db
                .update(studentProfiles)
                .set(profileUpdates)
                .where(and(eq(studentProfiles.userId, userId), eq(studentProfiles.schoolId, schoolId)))
                .returning();

            if (!updatedProfile) {
                return res.status(400).json({ error: "Student Profile not found" });
            }
        }

        if (Object.keys(userUpdates).length > 0) {
            [updatedUser] = await db
                .update(user)
                .set(userUpdates)
                .where(eq(user.id, userId))
                .returning();
        }

        return res.status(200).json({data: {
            updatedProfile: updatedProfile, 
            updatedUser: updatedUser
        }});
    } catch (error) {
        console.error("PATCH /students error: ", error);
        return res.status(500).json({error: "Failure to update student profile"});
    }
})

adminStudentsRouter.delete("/:userId", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {userId} = req.params;

        const [existing] = await db
            .select({userId: studentProfiles.userId})
            .from(studentProfiles)
            .where(and(eq(studentProfiles.userId, userId), eq(studentProfiles.schoolId, schoolId)))
            .limit(1);

        if(!existing){
            return res.status(400).json({error: "No student profile found"});
        }

        const deleteUser = await auth.api.removeUser({
            body: {
                userId
            },
            headers: req.headers,
        })

        if(deleteUser.success){
            return res.status(200).json({message: `Successfully deleted user ${userId}`});
        }else{
            return res.status(400).json({error: "Failed to delete student."});
        }
    } catch (error) {
        console.error("DELETE /students error: ", error);
        return res.status(500).json({error: "There was an error deleting the student"});
    }
})