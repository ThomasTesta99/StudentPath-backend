import express from "express"
import { getSchoolIdForAdmin } from "../../lib/utils";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { courses, enrollments, studentProfiles, user } from "../../db/schema";

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
            .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)));
        
        if(!verifyCourse){
            return res.status(404).json({error: "No course found"})
        }

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(enrollments)
            .where(eq(enrollments.courseId, courseId))

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