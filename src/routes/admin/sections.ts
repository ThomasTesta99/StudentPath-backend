import express from "express"
import { getSchoolIdForAdmin, optionalPositiveInt, optionalTrimmedString, requirePositiveInt, requireTrimmedString } from "../../lib/utils";
import { bellSchedules, courses, departments, enrollments, NewSection, periods, sections, teacherProfiles, terms, user } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { PatchSectionBody } from "../../types";

export const sectionsRouter = express.Router();

sectionsRouter.post("/", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const termId = requireTrimmedString(req.body.termId, "termId");
    const courseId = requireTrimmedString(req.body.courseId, "courseId");
    const periodId = requireTrimmedString(req.body.periodId, "periodId");
    const teacherId = requireTrimmedString(req.body.teacherId, "teacherId");
    const sectionLabel = requireTrimmedString(req.body.sectionLabel, "sectionLabel");

    const capacity = requirePositiveInt(req.body.capacity, "capacity");
    const roomNumber = optionalTrimmedString(req.body.roomNumber);

    const [term] = await db
        .select({ id: terms.id })
        .from(terms)
        .where(and(eq(terms.id, termId.trim()), eq(terms.schoolId, schoolId)))
        .limit(1);
    if (!term) return res.status(400).json({ error: "Invalid term (not in this school)" });

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, courseId.trim()), eq(courses.schoolId, schoolId)))
      .limit(1);
    if (!course) return res.status(400).json({ error: "Invalid course (not in this school)" });

    const [period] = await db
        .select({
            id: periods.id,
            scheduleSchoolId: bellSchedules.schoolId,
        })
        .from(periods)
        .innerJoin(bellSchedules, eq(periods.bellScheduleId, bellSchedules.id))
        .where(eq(periods.id, periodId.trim()))
        .limit(1);

    if (!period || period.scheduleSchoolId !== schoolId) {
        return res.status(400).json({ error: "Invalid period (not in this school)" });
    }

    const [teacher] = await db
        .select({ userId: teacherProfiles.userId })
        .from(teacherProfiles)
        .where(and(eq(teacherProfiles.userId, teacherId.trim()), eq(teacherProfiles.schoolId, schoolId)))
        .limit(1);

    if (!teacher) {
        return res.status(400).json({ error: "Invalid teacher (not in this school)" });
    }

    const roomNumberValue =
        typeof roomNumber === "string" && roomNumber.trim().length > 0
            ? roomNumber.trim()
            : null;

    const newSection: NewSection = {
      id: randomUUID(),
      schoolId,
      termId: termId.trim(),
      courseId: courseId.trim(),
      periodId: periodId.trim(),
      teacherId: teacherId.trim(),
      capacity: capacity,
      sectionLabel: sectionLabel,
      roomNumber: roomNumberValue,
    };

    const [created] = await db.insert(sections).values(newSection).returning();

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error("POST /sections error:", error);
    return res.status(500).json({ error: "There was an error creating the section" });
  }
});

sectionsRouter.get("/", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const {search, page = 1, limit = 10, courseId, periodId, termId} = req.query;
    
    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
    const offset = (currentPage - 1) * limitPerPage;


    const filterConditions = [];
    filterConditions.push(eq(sections.schoolId, schoolId));

    if(search){
        const s = requireTrimmedString(search, "search");
        if(s.length > 0){
            filterConditions.push(
                or(
                    ilike(sections.sectionLabel, `%${s}%`),
                    ilike(courses.code, `%${s}%`),
                    ilike(courses.name, `%${s}%`), 
                )
            )
        }
    }

    if(courseId){
        filterConditions.push(eq(sections.courseId, String(courseId)));
    }

    if(periodId){
        filterConditions.push(eq(sections.periodId, String(periodId)));
    }

    if(termId){
      filterConditions.push(eq(sections.termId, String(termId)));
    }

    const whereClause = and(...filterConditions);

    const countResult = await db
      .select({
        count: sql<number>`count(distinct ${sections.id})`,
      })
      .from(sections)
      .innerJoin(periods, eq(sections.periodId, periods.id))
      .innerJoin(terms, eq(sections.termId, terms.id))
      .innerJoin(teacherProfiles, eq(sections.teacherId, teacherProfiles.userId))
      .innerJoin(user, eq(teacherProfiles.userId, user.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(departments, eq(courses.departmentId, departments.id))
      .leftJoin(enrollments, eq(enrollments.sectionId, sections.id))
      .where(whereClause);

    const totalCount = Number(countResult[0]?.count ?? 0);

    const sectionsList = await db
      .select({
        ...getTableColumns(sections),
        enrolledCount: sql<number>`count(${enrollments.studentId})`,
        term: {
          ...getTableColumns(terms),
        },
        course: {
          ...getTableColumns(courses),
        },
        period: {
          ...getTableColumns(periods),
        },
        department: {
          ...getTableColumns(departments),
        },
        teacher: {
          ...getTableColumns(user),
        },
      })
      .from(sections)
      .innerJoin(periods, eq(sections.periodId, periods.id))
      .innerJoin(terms, eq(sections.termId, terms.id))
      .innerJoin(teacherProfiles, eq(sections.teacherId, teacherProfiles.userId))
      .innerJoin(user, eq(teacherProfiles.userId, user.id))
      .innerJoin(courses, eq(sections.courseId, courses.id))
      .innerJoin(departments, eq(courses.departmentId, departments.id))
      .leftJoin(enrollments, eq(enrollments.sectionId, sections.id))
      .where(whereClause)
      .groupBy(
        sections.id,
        terms.id,
        courses.id,
        periods.id,
        departments.id,
        user.id,
        teacherProfiles.userId
      )
      .limit(limitPerPage)
      .offset(offset)
      .orderBy(desc(sections.createdAt));

    const formattedSections = sectionsList.map((section) => ({
      ...section,
      enrolledCount: Number(section.enrolledCount ?? 0),
      availableSeats:
        section.capacity == null
          ? null
          : Math.max(section.capacity - Number(section.enrolledCount ?? 0), 0),
    }));

    return res.status(200).json({
      data: formattedSections, 
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      }, 
    })
  } catch (error) {
      console.error("GET /sections error:", error);
      return res.status(500).json({ error: "There was an error getting the section" });
  }
})

sectionsRouter.get("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {id} = req.params;

        const [section] = await db
            .select({
                ...getTableColumns(sections), 
                term: {
                    ...getTableColumns(terms), 
                },
                course: {
                    ...getTableColumns(courses) 
                },
                period: {
                    ...getTableColumns(periods), 
                },
                department: {
                    ...getTableColumns(departments)
                }, 
                teacher: {
                    ...getTableColumns(user)
                }
            })
            .from(sections)
            .innerJoin(periods, eq(sections.periodId, periods.id))
            .innerJoin(terms, eq(sections.termId, terms.id))
            .innerJoin(teacherProfiles, eq(sections.teacherId, teacherProfiles.userId))
            .innerJoin(user, eq(teacherProfiles.userId, user.id))
            .innerJoin(courses, eq(sections.courseId, courses.id))
            .innerJoin(departments, eq(courses.departmentId, departments.id))
            .where(
                and(
                    eq(sections.schoolId, schoolId), 
                    eq(sections.id, id),
                    eq(terms.schoolId, schoolId),
                    eq(courses.schoolId, schoolId),
                    eq(teacherProfiles.schoolId, schoolId),
                ))
            .limit(1);

        return res.status(200).json({data: section});
    } catch (error) {
        console.error("GET /sections error: ", error);
        return res.status(500).json({error: "There was an error getting the section"});
    }
})

sectionsRouter.patch("/:id", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { id } = req.params;
    const body = req.body as PatchSectionBody;

    const updates: Partial<NewSection> = {};

    if (body.termId !== undefined) updates.termId = body.termId.trim();
    if (body.courseId !== undefined) updates.courseId = body.courseId.trim();
    if (body.periodId !== undefined) updates.periodId = body.periodId.trim();
    if (body.teacherId !== undefined) updates.teacherId = body.teacherId.trim();

    if (body.capacity !== undefined) {
      updates.capacity = requirePositiveInt(body.capacity, "capacity");
    }

    if (body.roomNumber !== undefined) {
      updates.roomNumber = optionalTrimmedString(body.roomNumber);
    }

    if (body.sectionLabel !== undefined) {
      const label = optionalTrimmedString(body.sectionLabel);
      if (!label) return res.status(400).json({ error: "sectionLabel must not be empty" });
      updates.sectionLabel = label;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const [existing] = await db
      .select({
        id: sections.id,
        schoolId: sections.schoolId,
      })
      .from(sections)
      .where(and(eq(sections.id, id), eq(sections.schoolId, schoolId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Section not found" });
    }

    if (updates.termId) {
      const [term] = await db
        .select({ id: terms.id })
        .from(terms)
        .where(and(eq(terms.id, updates.termId), eq(terms.schoolId, schoolId)))
        .limit(1);
      if (!term) return res.status(400).json({ error: "Invalid term (not in this school)" });
    }

    if (updates.courseId) {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, updates.courseId), eq(courses.schoolId, schoolId)))
        .limit(1);
      if (!course) return res.status(400).json({ error: "Invalid course (not in this school)" });
    }

    if (updates.periodId) {
      const [period] = await db
        .select({
          id: periods.id,
          scheduleSchoolId: bellSchedules.schoolId,
        })
        .from(periods)
        .innerJoin(bellSchedules, eq(periods.bellScheduleId, bellSchedules.id))
        .where(eq(periods.id, updates.periodId))
        .limit(1);

      if (!period || period.scheduleSchoolId !== schoolId) {
        return res.status(400).json({ error: "Invalid period (not in this school)" });
      }
    }

    if (updates.teacherId) {
      const [teacher] = await db
        .select({ userId: teacherProfiles.userId })
        .from(teacherProfiles)
        .where(and(eq(teacherProfiles.userId, updates.teacherId), eq(teacherProfiles.schoolId, schoolId)))
        .limit(1);

      if (!teacher) {
        return res.status(400).json({ error: "Invalid teacher (not in this school)" });
      }
    }

    const [updated] = await db
      .update(sections)
      .set(updates)
      .where(and(eq(sections.id, id), eq(sections.schoolId, schoolId)))
      .returning();

    if (!updated) {
      return res.status(400).json({ error: "There was an error updating the section" });
    }

    return res.status(200).json({ data: updated });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({
        error: "Section conflicts with an existing section (teacher already scheduled in that period or duplicate section label).",
      });
    }

    console.error("PATCH /sections/:id error:", error);
    return res.status(500).json({ error: "There was an error updating the section" });
  }
});

sectionsRouter.delete("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {id} = req.params;

        const [deleted] = await db
            .delete(sections)
            .where(and(eq(sections.schoolId, schoolId), eq(sections.id, id)))
            .returning();

        if(!deleted) return res.status(404).json({error: "Section not found"});

        return res.status(200).json({data: deleted});
    } catch (error) {
        console.error("DELETE /sections error: ", error);
        return res.status(500).json({error: "There was an error deleting the section"});
    }
})