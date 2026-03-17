import express from 'express'
import { getTeacherInformation } from '../../lib/utils';
import { db } from '../../db';
import { and, asc, countDistinct, eq, getTableColumns } from 'drizzle-orm';
import {
  sections,
  courses,
  terms,
  periods,
  enrollments,
  teacherProfiles,
  bellSchedules,
  studentProfiles,
  user,
} from "../../db/schema";

export const teacherSectionRouter = express.Router();


teacherSectionRouter.get("/", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        }

        const schoolId = teacher.schoolId;
        const userId = teacher.userId;

        const teacherSections = await db
            .select({
                ...getTableColumns(sections),
                course: {...getTableColumns(courses)}, 
                term: {...getTableColumns(terms)},
                period: {...getTableColumns(periods)},
                bellSchedule: {...getTableColumns(bellSchedules)}, 
                studentCount: countDistinct(enrollments.studentId), 
            })
            .from(sections)
            .innerJoin(
                teacherProfiles, 
                and(
                    eq(teacherProfiles.userId, sections.teacherId),
                    eq(teacherProfiles.schoolId, schoolId), 
                )
            )
            .innerJoin(
                courses, 
                and(
                    eq(courses.id, sections.courseId),
                    eq(courses.schoolId, schoolId), 
                )
            )
            .innerJoin(
                terms, 
                and(
                    eq(terms.id, sections.termId), 
                    eq(terms.schoolId, schoolId), 
                )
            )
            .innerJoin(periods, eq(periods.id, sections.periodId))
            .leftJoin(bellSchedules, eq(bellSchedules.id, periods.bellScheduleId))
            .leftJoin(enrollments, eq(enrollments.sectionId, sections.id))
            .where(
                and(
                    eq(sections.teacherId, userId),
                    eq(sections.schoolId, schoolId)
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
                asc(courses.name)
            );

            return res.status(200).json({
                data: teacherSections
            })
    } catch (error) {
        console.error("GET /teachers/sections: ", error);
        return res.status(500).json({error: "There was an error getting the teacher sections"});
    }
})

teacherSectionRouter.get("/:sectionId", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        }

        const schoolId = teacher.schoolId;
        const userId = teacher.userId;

        const {sectionId} = req.params;

        const [section] = await db
            .select({
                ...getTableColumns(sections),
                course: {...getTableColumns(courses)},
                term: {...getTableColumns(terms)},
                period: {...getTableColumns(periods)}, 
                bellSchedule: {...getTableColumns(bellSchedules)}, 
                studentCount: countDistinct(enrollments.studentId), 
            })
            .from(sections)
            .innerJoin(
                courses, 
                and(
                    eq(courses.id, sections.courseId),
                    eq(courses.schoolId, schoolId), 
                )
            )
            .innerJoin(
                terms, 
                and(
                    eq(terms.id, sections.termId), 
                    eq(terms.schoolId, schoolId), 
                )
            )
            .innerJoin(periods, eq(periods.id, sections.periodId))
            .leftJoin(bellSchedules, eq(bellSchedules.id, periods.bellScheduleId))
            .leftJoin(enrollments, eq(enrollments.sectionId, sections.id))
            .where(
                and(
                    eq(sections.teacherId, userId),
                    eq(sections.schoolId, schoolId),
                    eq(sections.id, sectionId)
                )
            )
            .groupBy(
                sections.id, 
                courses.id, 
                terms.id, 
                periods.id, 
                bellSchedules.id
            )
            .limit(1);

            if(!section){
                return res.status(404).json({error: "Section not found"});
            }

            return res.status(200).json({data: {
                ...section, 
                teacher: teacher, 
            }})
    } catch (error) {
        console.error("GET /teacher/sections/:id error: ", error);
        return res.status(500).json({error: "There was an error getting the section information"})
    }
})

teacherSectionRouter.get("/:sectionId/students", async (req, res) => {
  try {
    const teacher = await getTeacherInformation(req);

    if (!teacher) {
      return res.status(401).json({ error: "Not authorized" });
    }

    const schoolId = teacher.schoolId;
    const userId = teacher.userId;
    const { sectionId } = req.params;

    const [ownedSection] = await db
      .select({ id: sections.id })
      .from(sections)
      .innerJoin(
        teacherProfiles,
        and(
          eq(teacherProfiles.userId, sections.teacherId),
          eq(teacherProfiles.schoolId, schoolId)
        )
      )
      .where(
        and(
          eq(sections.id, sectionId),
          eq(sections.teacherId, userId),
          eq(sections.schoolId, schoolId)
        )
      )
      .limit(1);

    if (!ownedSection) {
      return res.status(404).json({ error: "Section not found" });
    }

    const students = await db
      .select({
        studentId: studentProfiles.userId,
        name: user.name,
        osis: studentProfiles.osis,
        gradeLevel: studentProfiles.gradeLevel,
        enrollmentCreatedAt: enrollments.createdAt,
      })
      .from(enrollments)
      .innerJoin(
        sections,
        and(
          eq(sections.id, enrollments.sectionId),
          eq(sections.schoolId, schoolId),
          eq(sections.teacherId, userId)
        )
      )
      .innerJoin(
        studentProfiles,
        and(
          eq(studentProfiles.userId, enrollments.studentId),
          eq(studentProfiles.schoolId, schoolId)
        )
      )
      .innerJoin(user, eq(user.id, studentProfiles.userId))
      .where(eq(enrollments.sectionId, sectionId))
      .orderBy(user.name);

    return res.status(200).json({
      data: students,
    });
  } catch (error) {
    console.error("GET /teacher/sections/:sectionId/students error:", error);
    return res.status(500).json({
      error: "There was an error getting the section roster",
    });
  }
});