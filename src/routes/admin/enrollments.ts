import express from "express";
import { getSchoolIdForAdmin } from "../../lib/utils";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  courses,
  enrollments,
  NewEnrollment,
  sections,
  studentProfiles,
  user,
} from "../../db/schema";

export const enrollmentsRouter = express.Router();

enrollmentsRouter.get("/:sectionId/roster", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { sectionId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (typeof sectionId !== "string" || sectionId.trim().length === 0) {
      return res.status(400).json({ error: "sectionId is required" });
    }

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100
    );
    const offset = (currentPage - 1) * limitPerPage;

    const [verifySection] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.schoolId, schoolId)))
      .limit(1);

    if (!verifySection) {
      return res.status(404).json({ error: "Section not found" });
    }

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(eq(enrollments.sectionId, sectionId));

    const totalCount = countResult[0]?.count ?? 0;

    const enrollmentList = await db
      .select({
        ...getTableColumns(enrollments),
        student: {
          userId: user.id,
          name: user.name,
          email: user.email,
          osis: studentProfiles.osis,
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
    });
  } catch (error) {
    console.error("GET /enrollments/:sectionId/roster error: ", error);
    return res
      .status(500)
      .json({ error: "There was an error getting the enrollments" });
  }
});

enrollmentsRouter.get("/", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { studentId } = req.query;

    if (typeof studentId !== "string" || studentId.trim().length === 0) {
      return res.status(400).json({ error: "studentId is required" });
    }

    const studentEnrollments = await db
      .select({
        ...getTableColumns(enrollments),
        section: { ...getTableColumns(sections) },
        course: { ...getTableColumns(courses) },
        teacher: { name: user.name },
      })
      .from(enrollments)
      .innerJoin(sections, eq(enrollments.sectionId, sections.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(user, eq(sections.teacherId, user.id))
      .innerJoin(studentProfiles, eq(enrollments.studentId, studentProfiles.userId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(studentProfiles.schoolId, schoolId),
          eq(sections.schoolId, schoolId),
          eq(courses.schoolId, schoolId)
        )
      )
      .orderBy(desc(enrollments.createdAt));

    return res.status(200).json({
      data: studentEnrollments,
      pagination: { total: studentEnrollments.length },
    });
  } catch (error) {
    console.error("GET /enrollments error:", error);
    return res.status(500).json({
      error: "There was an error retrieving the enrollments for this student",
    });
  }
});

enrollmentsRouter.post("/", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { studentId, sectionId } = req.body;

    if (typeof studentId !== "string" || studentId.trim().length === 0) {
      return res.status(400).json({ error: "studentId is required" });
    }
    if (typeof sectionId !== "string" || sectionId.trim().length === 0) {
      return res.status(400).json({ error: "sectionId is required" });
    }

    const [section] = await db
      .select()
      .from(sections)
      .where(and(eq(sections.schoolId, schoolId), eq(sections.id, sectionId)))
      .limit(1);

    if (!section) {
      return res.status(404).json({ error: "No section found" });
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

    const count = await db
      .select({count: sql<number>`count(*)`})
      .from(enrollments)
      .where(eq(enrollments.sectionId, sectionId));

    const totalCount = Number(count[0]?.count ?? 0);
    if(section.capacity !== null && totalCount >= section.capacity){
      return res.status(400).json({error: "Section is full"});
    }

    const newEnrollment: NewEnrollment = {
      sectionId,
      studentId,
    };

    const [enrollmentResult] = await db
      .insert(enrollments)
      .values(newEnrollment)
      .onConflictDoNothing()
      .returning();

    if (!enrollmentResult) {
      return res
        .status(409)
        .json({ error: "Student is already enrolled in this section" });
    }

    return res.status(201).json({ data: enrollmentResult });
  } catch (error) {
    console.error("POST /enrollments error: ", error);
    return res
      .status(500)
      .json({ error: "There was an error creating the enrollment" });
  }
});

enrollmentsRouter.delete("/:sectionId/:studentId", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { sectionId, studentId } = req.params;

    if (typeof sectionId !== "string" || sectionId.trim().length === 0) {
      return res.status(400).json({ error: "sectionId is required" });
    }
    if (typeof studentId !== "string" || studentId.trim().length === 0) {
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