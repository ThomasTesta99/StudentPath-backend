import express from "express"
import { getTeacherInformation } from "../../lib/utils";
import { bellSchedules, courses, enrollments, periods, sections, teacherProfiles, terms } from "../../db/schema";
import { db } from "../../db";
import { and, asc, countDistinct, eq, getTableColumns, gte } from "drizzle-orm";

export const teacherCourseRouter = express.Router();

teacherCourseRouter.get("/", async (req, res) => {
  try {
    const teacher = await getTeacherInformation(req);
    if (!teacher) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const today = new Date()

    const teacherCourses = await db
      .selectDistinct({
        id: courses.id,
        schoolId: courses.schoolId,
        departmentId: courses.departmentId,
        name: courses.name,
        code: courses.code,
        gradeLevel: courses.gradeLevel,
        description: courses.description,
      })
      .from(sections)
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(terms, eq(sections.termId, terms.id))
      .where(
        and(
          eq(sections.teacherId, teacher.userId),
          gte(terms.endDate, today)
        )
      )
      .orderBy(asc(courses.name));

    return res.status(200).json({
      data: teacherCourses,
    });
  } catch (error) {
    console.error("GET /teacher/courses error:", error);
    return res.status(500).json({
      error: "There was an error getting courses for this teacher",
    });
  }
});

teacherCourseRouter.get("/:courseId/sections", async (req, res) => {
  try {
    const teacher = await getTeacherInformation(req);
    if (!teacher) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const { courseId } = req.params;
    const schoolId = teacher.schoolId;
    const userId = teacher.userId;
    const today = new Date();

    const teacherSections = await db
      .select({
        ...getTableColumns(sections),
        course: { ...getTableColumns(courses) },
        term: { ...getTableColumns(terms) },
        period: { ...getTableColumns(periods) },
        bellSchedule: { ...getTableColumns(bellSchedules) },
        enrolledCount: countDistinct(enrollments.studentId),
      })
      .from(sections)
      .innerJoin(
        teacherProfiles,
        and(
          eq(teacherProfiles.userId, sections.teacherId),
          eq(teacherProfiles.schoolId, schoolId)
        )
      )
      .innerJoin(
        courses,
        and(
          eq(courses.id, sections.courseId),
          eq(courses.schoolId, schoolId)
        )
      )
      .innerJoin(
        terms,
        and(
          eq(terms.id, sections.termId),
          eq(terms.schoolId, schoolId)
        )
      )
      .innerJoin(periods, eq(periods.id, sections.periodId))
      .leftJoin(bellSchedules, eq(bellSchedules.id, periods.bellScheduleId))
      .leftJoin(enrollments, eq(enrollments.sectionId, sections.id))
      .where(
        and(
          eq(sections.teacherId, userId),
          eq(sections.schoolId, schoolId),
          eq(sections.courseId, courseId),
          gte(terms.endDate, today)
        )
      )
      .groupBy(
        sections.id,
        courses.id,
        terms.id,
        periods.id,
        bellSchedules.id
      )
      .orderBy(
        asc(terms.startDate),
        asc(periods.number),
        asc(sections.sectionLabel)
      );

    return res.status(200).json({
      data: teacherSections,
    });
  } catch (error) {
    console.error("GET /teacher/courses/:courseId/sections:", error);
    return res.status(500).json({
      error: "There was an error getting sections for this course",
    });
  }
});