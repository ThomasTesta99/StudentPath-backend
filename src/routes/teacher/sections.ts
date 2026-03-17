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