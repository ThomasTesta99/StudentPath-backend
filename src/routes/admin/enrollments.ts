import express from "express";
import { getSchoolIdForAdmin, optionalTrimmedString } from "../../lib/utils";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import {
  courses,
  enrollments,
  NewEnrollment,
  periods,
  sections,
  studentProfiles,
  user,
} from "../../db/schema";
import { alias } from "drizzle-orm/pg-core";

export const enrollmentsRouter = express.Router();

const studentUser = alias(user, "student_user");
const teacherUser = alias(user, "teacher_user");

enrollmentsRouter.get("/:sectionId/roster", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { page = 1, limit = 10} = req.query;

    const sectionId = optionalTrimmedString(req.params.sectionId);

    if (!sectionId) {
      return res.status(400).json({ error: "sectionId is required" });
    }

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100
    );
    const offset = (currentPage - 1) * limitPerPage;

    const [sectionResult] = await db
      .select({
        section: {
          ...getTableColumns(sections),
        },
        course: {
          ...getTableColumns(courses),
        },
        teacher: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(sections)
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(user, eq(sections.teacherId, user.id))
      .where(and(eq(sections.id, sectionId), eq(sections.schoolId, schoolId)))
      .limit(1);

    if (!sectionResult) {
      return res.status(404).json({ error: "Section not found" });
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
      .where(
        and(
          eq(enrollments.sectionId, sectionId),
          eq(studentProfiles.schoolId, schoolId)
        )
      );

    const totalCount = countResult[0]?.count ?? 0;

    const roster = await db
      .select({
        ...getTableColumns(enrollments),
        student: {
          userId: user.id,
          name: user.name,
          email: user.email,
          osis: studentProfiles.osis,
          gradeLevel: studentProfiles.gradeLevel,
        },
      })
      .from(enrollments)
      .innerJoin(user, eq(enrollments.studentId, user.id))
      .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
      .where(
        and(
          eq(enrollments.sectionId, sectionId),
          eq(studentProfiles.schoolId, schoolId)
        )
      )
      .orderBy(desc(enrollments.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    return res.status(200).json({
      data: roster,
      // meta: {
      //   section: sectionResult.section,
      //   course: sectionResult.course,
      //   teacher: sectionResult.teacher,
      //   capacity: sectionResult.section.capacity,
      //   enrolledCount: totalCount,
      //   availableSeats:
      //     sectionResult.section.capacity === null
      //       ? null
      //       : Math.max(sectionResult.section.capacity - totalCount, 0),
      // },
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error("GET /enrollments/:sectionId/roster error: ", error);
    return res
      .status(500)
      .json({ error: "There was an error getting the enrollments" });
  }
});

enrollmentsRouter.get("/student/:studentId", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const studentId = optionalTrimmedString(req.params.studentId);
    const termId = optionalTrimmedString(req.query.termId);

    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }

    const filterConditions = [
      eq(enrollments.studentId, studentId),
      eq(studentProfiles.schoolId, schoolId),
      eq(sections.schoolId, schoolId),
      eq(courses.schoolId, schoolId)
    ];

    if(termId){
      filterConditions.push(eq(sections.termId, termId));
    }

    const whereClause = and(...filterConditions);

    const studentEnrollments = await db
      .select({
        ...getTableColumns(enrollments),
        section: { ...getTableColumns(sections) },
        course: { ...getTableColumns(courses) },
        teacher: { name: teacherUser.name },
        student: { ...getTableColumns(studentUser) }
      })
      .from(enrollments)
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(teacherUser, eq(sections.teacherId, teacherUser.id))
      .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
      .innerJoin(studentUser, eq(studentUser.id, enrollments.studentId))
      .where(whereClause)
      .orderBy(desc(enrollments.createdAt));

    return res.status(200).json({
      data: studentEnrollments,
      pagination: { total: studentEnrollments.length },
    });
  } catch (error) {
    console.error("GET /enrollments/student/:studentId error:", error);
    return res.status(500).json({
      error: "There was an error retrieving the enrollments for this student",
    });
  }
});

enrollmentsRouter.get("/", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const {page = 1, limit = 10} = req.query;
        
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
    const offset = (currentPage - 1) * limitPerPage;

    const search = optionalTrimmedString(req.query.search);
    const termId = optionalTrimmedString(req.query.termId);
    const courseId = optionalTrimmedString(req.query.courseId);
    const teacherId = optionalTrimmedString(req.query.teacherId);
    const studentId = optionalTrimmedString(req.query.studentId);
    const gradeLevel = optionalTrimmedString(req.query.gradeLevel);

    const filterConditions = [
      eq(sections.schoolId, schoolId),
      eq(courses.schoolId, schoolId),
      eq(studentProfiles.schoolId, schoolId)
    ];

    if(termId){
      filterConditions.push(eq(sections.termId, termId));
    }

    if(courseId){
      filterConditions.push(eq(courses.id, courseId));
    }

    if(teacherId){
      filterConditions.push(eq(sections.teacherId, teacherId));
    }

    if(studentId){
      filterConditions.push(eq(enrollments.studentId, studentId));
    }

    if(gradeLevel){
      filterConditions.push(eq(studentProfiles.gradeLevel, gradeLevel));
    }

    if(search){
      const searchTerm = `%${search}%`;

      filterConditions.push(
        or(
          ilike(studentUser.name, searchTerm),
          ilike(studentUser.email, searchTerm),
          ilike(studentProfiles.osis, searchTerm),
          ilike(courses.name, searchTerm),
          ilike(courses.code, searchTerm),
          ilike(sections.sectionLabel, searchTerm),
          ilike(teacherUser.name, searchTerm)
        )!
      )
    }

    const whereClause = and(...filterConditions);

    const countResult = await db
      .select({count: sql<number>`count(*)`})
      .from(enrollments)
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
      .innerJoin(studentUser, eq(enrollments.studentId, studentUser.id))
      .innerJoin(teacherUser, eq(sections.teacherId, teacherUser.id))
      .where(whereClause);

    const totalCount = countResult[0]?.count ?? 0;

    const enrollmentList = await db
      .select({
        ...getTableColumns(enrollments), 
        student: {
          id: studentUser.id, 
          name: studentUser.name, 
          email: studentUser.email, 
          osis: studentProfiles.osis, 
          gradeLevel: studentProfiles.gradeLevel, 
        }, 
        section: {
          ...getTableColumns(sections),
        },
        period: {
          ...getTableColumns(periods), 
        }, 
        course: {
          ...getTableColumns(courses), 
        },
        teacher: {
          id: teacherUser.id, 
          name: teacherUser.name, 
          email: teacherUser.email
        }
      })
      .from(enrollments)
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(periods, eq(sections.periodId, periods.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
      .innerJoin(studentUser, eq(enrollments.studentId, studentUser.id))
      .innerJoin(teacherUser, eq(sections.teacherId, teacherUser.id))
      .where(whereClause)
      .orderBy(desc(enrollments.createdAt))
      .limit(limitPerPage)
      .offset(offset);

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
    console.error("GET", error);
    return res.status(500).json({error: "There was an error getting the enrollments"});
  }
})

enrollmentsRouter.post("/", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const sectionId = optionalTrimmedString(req.body.sectionId);
    const studentId = optionalTrimmedString(req.body.studentId);

    if (!sectionId) {
      return res.status(400).json({ error: "sectionId is required" });
    }

    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }

    const [student] = await db
      .select({ id: studentProfiles.userId })
      .from(studentProfiles)
      .where(
        and(
          eq(studentProfiles.schoolId, schoolId),
          eq(studentProfiles.userId, studentId)
        )
      )
      .limit(1);

    if (!student) {
      return res.status(404).json({ error: "No student found" });
    }

    const newEnrollment: NewEnrollment = {
      sectionId,
      studentId,
    };

    const enrollmentResult = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select 1
        from ${sections}
        where ${sections.schoolId} = ${schoolId}
          and ${sections.id} = ${sectionId}
        for update
      `);

      const [section] = await tx
        .select()
        .from(sections)
        .where(and(eq(sections.schoolId, schoolId), eq(sections.id, sectionId)))
        .limit(1);

      if (!section) {
        throw new Error("SECTION_NOT_FOUND");
      }

      await tx.execute(
        sql`select 1 from ${sections} where ${sections.id} = ${sectionId} for update`
      );

      const countResult = await tx
        .select({ count: sql<number>`count(*)` })
        .from(enrollments)
        .where(eq(enrollments.sectionId, sectionId));

      const totalCount = Number(countResult[0]?.count ?? 0);

      if (section.capacity !== null && totalCount >= section.capacity) {
        throw new Error("SECTION_FULL");
      }

      await tx.execute(sql`
        select 1
        from ${studentProfiles}
        where ${studentProfiles.userId} = ${studentId}
          and ${studentProfiles.schoolId} = ${schoolId}
        for update
     `);

      const existingStudentEnrollments = await tx
        .select({
          enrollment: {
            ...getTableColumns(enrollments),
          },
          section: {
            ...getTableColumns(sections),
          },
        })
        .from(enrollments)
        .innerJoin(sections, eq(enrollments.sectionId, sections.id))
        .innerJoin(
          studentProfiles,
          and(
            eq(enrollments.studentId, studentProfiles.userId),
            eq(studentProfiles.schoolId, schoolId)
          )
        )
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(sections.schoolId, schoolId),
            eq(sections.termId, section.termId)
          )
        );

      const sameCourseEnrollment = existingStudentEnrollments.find(
        (item) => item.section.courseId === section.courseId
      );

      if (sameCourseEnrollment) {
        throw new Error("DUPLICATE_COURSE_ENROLLMENT");
      }

      const samePeriodEnrollment =
        section.periodId === null
          ? undefined
          : existingStudentEnrollments.find(
              (item) => item.section.periodId === section.periodId
            );

      if (samePeriodEnrollment) {
        throw new Error("SCHEDULE_CONFLICT");
      }

      const [created] = await tx
        .insert(enrollments)
        .values(newEnrollment)
        .onConflictDoNothing()
        .returning();

      if (!created) {
        throw new Error("ALREADY_ENROLLED");
      }

      return created;
    });

    return res.status(201).json({ data: enrollmentResult });
  } catch (error) {
    console.error("POST /enrollments error:", error);

    if (error instanceof Error) {
      switch (error.message) {
        case "SECTION_NOT_FOUND":
          return res.status(404).json({ error: "No section found" });
        case "SECTION_FULL":
          return res.status(400).json({ error: "Section is full" });
        case "DUPLICATE_COURSE_ENROLLMENT":
          return res.status(409).json({
            error: "Student is already enrolled in this course for the selected term",
          });
        case "SCHEDULE_CONFLICT":
          return res.status(409).json({
            error: "Student already has another section during this period for the selected term",
          });
        case "ALREADY_ENROLLED":
          return res.status(409).json({
            error: "Student is already enrolled in this section",
          });
      }
    }

    return res
      .status(500)
      .json({ error: "There was an error creating the enrollment" });
  }
});

enrollmentsRouter.delete("/:sectionId/:studentId", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const sectionId = optionalTrimmedString(req.params.sectionId);
    const studentId = optionalTrimmedString(req.params.studentId);

    if (!sectionId) {
      return res.status(400).json({ error: "sectionId is required" });
    }

    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }


    const [section] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.schoolId, schoolId), eq(sections.id, sectionId)))
      .limit(1);

    if (!section) {
      return res.status(404).json({ error: "No section found" });
    }

    const [deleted] = await db
      .delete(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.sectionId, sectionId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Enrollment not found" });
    }

    return res.status(200).json({ data: deleted });
  } catch (error) {
    console.error("DELETE /enrollments error: ", error);
    return res
      .status(500)
      .json({ error: "There was an error deleting the enrollment" });
  }
});