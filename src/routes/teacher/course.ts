import express from "express"
import { getTeacherInformation } from "../../lib/utils";
import { courses, periods, sections, terms } from "../../db/schema";
import { db } from "../../db";
import { and, asc, eq, gte } from "drizzle-orm";

export const teacherCourseRouter = express.Router();

teacherCourseRouter.get("/:courseId/sections", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if (!teacher) {
            return res.status(401).json({ error: "Not authorized" });
        }

        const { courseId } = req.params;
        const today = new Date(); 
        const teacherSections = await db
            .select({
                id: sections.id,
                courseId: sections.courseId,
                sectionLabel: sections.sectionLabel,
                roomNumber: sections.roomNumber,
                capacity: sections.capacity,
                periodId: sections.periodId,
                termId: sections.termId,
                termName: terms.termName,
                courseName: courses.name,
                courseCode: courses.code,
                gradeLevel: courses.gradeLevel,
                periodNumber: periods.number,
                periodStartTime: periods.startTime,
                periodEndTime: periods.endTime,
            })
            .from(sections)
            .innerJoin(courses, eq(sections.courseId, courses.id))
            .leftJoin(periods, eq(sections.periodId, periods.id))
            .innerJoin(terms, eq(terms.id, sections.termId))
            .where(
                and(
                    eq(sections.courseId, courseId),
                    eq(sections.teacherId, teacher.userId),
                    gte(terms.endDate, today)
                )
            )
            .orderBy(asc(periods.number), asc(sections.sectionLabel));

        return res.status(200).json({
            data: teacherSections,
        });
    } catch (error) {
        console.error("GET /:courseId/sections error: ", error);
        return res.status(500).json({
            error: "There was an error getting sections for this course",
        });
    }
});