import express from 'express'
import { getTeacherInformation, optionalTrimmedString } from '../../lib/utils';
import { db } from '../../db';
import { and, asc, countDistinct, desc, eq, getTableColumns, gte, ilike, lt, sql } from 'drizzle-orm';
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
  assignments,
  assignmentTypeEnum,
} from "../../db/schema";
import { AssignmentType } from '../../types';

export const teacherSectionRouter = express.Router();

teacherSectionRouter.get("/", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        }

        const schoolId = teacher.schoolId;
        const userId = teacher.userId;

        const termId = optionalTrimmedString(req.query.termId);
        const filterConditions = [
            eq(sections.teacherId, userId),
            eq(sections.schoolId, schoolId)
        ];

        if(termId){
            filterConditions.push(eq(sections.termId, termId));
        }

        const whereClause = and(...filterConditions);

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
                whereClause
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
      .orderBy(
        sql`split_part(${user.name}, ' ', array_length(string_to_array(${user.name}, ' '), 1)) asc`,
        sql`${user.name} asc`
      );

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

teacherSectionRouter.get("/:sectionId/assignments", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if (!teacher) {
        return res.status(401).json({ error: "Not authorized" });
        }

        const {sectionId} = req.params;
        const {search, page = 1, limit = 10} = req.query;
        const type = optionalTrimmedString(req.query.type);
        const status = optionalTrimmedString(req.query.status);
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const [section] = await db
            .select()
            .from(sections)
            .where(
                and(
                    eq(sections.id, sectionId),
                    eq(sections.teacherId, teacher.userId),
                )
            )
            .limit(1);

        if(!section){
            return res.status(404).json({error: "No section found"});
        }

        const filterConditions = [eq(assignments.sectionId, sectionId)];

        if(search){
            const s = String(search).trim();
            if(s.length > 0){
                filterConditions.push(
                    ilike(assignments.title, `%${s}%`),
                )
            }
        }

        if(type){
            if((assignmentTypeEnum.enumValues as readonly string[]).includes(type)){
                filterConditions.push(eq(assignments.type, type as AssignmentType));
            }
        }
        
        if(status){
            const today = new Date().toISOString().slice(0, 10);
            if(status === "upcoming"){
                filterConditions.push(gte(assignments.dueDate, today));
            }else if(status === "past"){
                filterConditions.push(lt(assignments.dueDate, today));
            }
        }

        const whereClause = and(...filterConditions);

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(assignments)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const assignmentList = await db
            .select()
            .from(assignments)
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(assignments.createdAt));

        return res.status(200).json({
            data: assignmentList, 
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }, 
        });
    } catch (error) {
       console.error("GET /:sectionId/assignments error: ", error);
       return res.status(500).json({error:"There was an error getting this section's assignments"}); 
    }
})