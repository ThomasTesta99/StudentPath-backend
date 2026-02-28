import express from "express"
import { getSchoolIdForAdmin } from "../../lib/utils";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { courses, enrollments, NewEnrollment, studentProfiles, user } from "../../db/schema";

export const enrollmentsRouter = express.Router();

enrollmentsRouter.get("/:courseId/roster", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {courseId} = req.params;
        const {page = 1, limit = 10} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage; 

        const [verifyCourse] = await db
            .select({id: courses.id})
            .from(courses)
            .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
            .limit(1);
        
        if(!verifyCourse){
            return res.status(404).json({error: "No course found"})
        }

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(enrollments)
            .where(eq(enrollments.courseId, courseId));

        const totalCount = countResult[0]?.count ?? 0;

        const enrollmentList = await db
            .select({
                ...getTableColumns(enrollments),
                student: {
                    userId: user.id,
                    name: user.name, 
                    email: user.email, 
                    osis: studentProfiles.osis,
                }
            })
            .from(enrollments)
            .innerJoin(user, eq(enrollments.studentId, user.id))
            .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
            .where(eq(enrollments.courseId, courseId))
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(enrollments.createdAt));

        return res.status(200).json({
            data: enrollmentList, 
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        })

    } catch (error) {
        console.error("GET /enrollments error: ", error);
        return res.status(500).json({error: "There was an error getting the enrollments"});
    }
})

enrollmentsRouter.get("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) {
            return res.status(401).json({ error: "Not authorized" });
        }

        const {studentId} = req.query;
        
        const studentEnrollments = await db
            .select({
                ...getTableColumns(enrollments),
                course: {
                    ...getTableColumns(courses),
                },
                teacher: {
                    name: user.name
                }
            })
            .from(enrollments)
            .innerJoin(courses, eq(enrollments.courseId, courses.id))
            .innerJoin(user, eq(courses.teacherId, user.id))
            .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
            .where(
                and(
                    eq(enrollments.studentId, String(studentId)),
                    eq(studentProfiles.schoolId, schoolId)
                )
            );

        return res.status(200).json({
            data: studentEnrollments,
            pagination: {
                total: studentEnrollments.length,
            },
        });
    } catch (error) {
        console.error("GET /enrollments error:", error);
        return res.status(500).json({
            error: "There was an error retrieving the enrollments for this student",
        });
    }
});

enrollmentsRouter.post("/:courseId", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {courseId} = req.params;
        const {studentId} = req.body;

        if (typeof studentId !== "string" || studentId.trim().length === 0) {
            return res.status(400).json({ error: "studentId is required" });
        }

        const [course] = await db
            .select({id: courses.id})
            .from(courses)
            .where(and(eq(courses.schoolId, schoolId), eq(courses.id, courseId)))
            .limit(1);
        
        if(!course){
            return res.status(404).json({error: "No course found"});
        }

        const [student] = await db
            .select({id: studentProfiles.userId})
            .from(studentProfiles)
            .where(and(eq(studentProfiles.schoolId, schoolId), eq(studentProfiles.userId, studentId)))
            .limit(1);

        if(!student){
            return res.status(404).json({error: "No student found"});
        }

        const newEnrollment: NewEnrollment = {
            courseId: courseId, 
            studentId: studentId, 
        }

        const [enrollmentResult] = await db
            .insert(enrollments)
            .values(newEnrollment)
            .onConflictDoNothing()
            .returning();

        if (!enrollmentResult) {
            return res.status(409).json({ error: "Student is already enrolled in this course" });
        }

        return res.status(201).json({data: enrollmentResult })
    } catch (error) {
        console.error("POST /enrollments error: ", error);
        return res.status(500).json({error: "There was an error creating the enrollment"});
    }
})

enrollmentsRouter.delete("/:courseId/:studentId", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {courseId, studentId} = req.params;

        const [course] = await db
            .select({id: courses.id})
            .from(courses)
            .where(and(eq(courses.schoolId, schoolId), eq(courses.id, courseId)))
            .limit(1);
        
        if(!course){
            return res.status(404).json({error: "No course found"});
        }

        const [deleted] = await db
            .delete(enrollments)
            .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
            .returning();

        if(!deleted){
            return res.status(404).json({error: "Enrollment not found"});
        }

        return res.status(200).json({data: deleted});
    } catch (error) {
        console.error("DELETE /enrollments error: ", error);
        return res.status(500).json({error: "There was an error deleting the enrollment"});
    }
})