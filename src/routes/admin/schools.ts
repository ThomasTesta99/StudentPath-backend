import express from 'express';
import { and, desc, eq, getTableColumns, ilike, sql } from 'drizzle-orm';
import { gradeLevelEnum, NewSchool, NewSchoolGradeLevel, School, schoolGradeLevels, schools } from '../../db/schema';
import { db } from '../../db';
import { randomUUID } from 'crypto';
import { getSchoolIdForAdmin, normalizeGradeLevels } from '../../lib/utils';
import { PatchSchoolBody } from '../../types';

export const schoolsRouter = express.Router();

schoolsRouter.get("/me", async(req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const [school] = await db
            .select()
            .from(schools)
            .where(eq(schools.id, schoolId))
            .limit(1);

        if(!school){
            return res.status(404).json({error: "School not found"})
        }
        const gradeLevelRows = await db
            .select({ gradeLevel: schoolGradeLevels.gradeLevel })
            .from(schoolGradeLevels)
            .where(eq(schoolGradeLevels.schoolId, schoolId));

        return res.status(200).json({
            data: {
                ...school, 
                gradeLevels: gradeLevelRows.map((grade)=> grade.gradeLevel),
            }
        })
    } catch (error) {
        console.error("GET /school error: ", error);
        res.status(500).json({error: "Failed to fetch school"});
    }
});

schoolsRouter.get("/me/grade-levels", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const gradeLevelRows = await db
      .select({ gradeLevel: schoolGradeLevels.gradeLevel })
      .from(schoolGradeLevels)
      .where(eq(schoolGradeLevels.schoolId, schoolId));

    const sorted = gradeLevelRows
        .map((g) => g.gradeLevel)
        .sort((a, b) => Number(a) - Number(b));

    return res.status(200).json({
      data: sorted,
    });
  } catch (error) {
    console.error("GET /schools/me/grade-levels error:", error);
    return res.status(500).json({ error: "Failed to fetch grade levels" });
  }
});

schoolsRouter.get("/", async (req, res) => {
    try {
        const {search, page = 1, limit = 10} = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if(search){
            filterConditions.push(
                ilike(schools.schoolName, `%${search}%`),
            )
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(schools)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const schoolsList: School[] = await db
            .select()
            .from(schools)
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(schools.createdAt));

        return res.status(200).json({
            data: schoolsList,
            pagination: {
                page: currentPage, 
                limit: limitPerPage, 
                total: totalCount, 
                totalPages: Math.ceil(totalCount / limitPerPage)
            },
        });
    } catch (error) {
        console.error("GET /schools error: ", error);
        res.status(500).json({error: "Failed to fetch schools"});
    }
});

schoolsRouter.post("/", async (req, res) => {
    try {
        const {schoolName} = req.body;

        if(typeof schoolName !== "string" || schoolName.trim().length === 0){
            return res.status(400).json({ error: "The school name is required" });
        }

        const newSchool : NewSchool = {
            id: randomUUID(),
            schoolName: schoolName.trim(),
        }

        const [createdSchool] = await db
            .insert(schools)
            .values({...newSchool})
            .returning({id: schools.id, schoolName: schools.schoolName});

        return res.status(201).json({
            data: createdSchool
        })
    } catch (error) {
        console.error("POST /schools error: ", error);
        res.status(500).json({error: "Failed to create a school"});
    }
});

schoolsRouter.patch("/me", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        const {schoolName, gradeLevels} = req.body as PatchSchoolBody;

        const updates: Partial<NewSchool> = {};
        const hasSchoolName = typeof schoolName === "string";
        const hasGradeLevels = gradeLevels !== undefined;
        
        if(!hasGradeLevels && !hasSchoolName){
            return res.status(400).json({error: "No valid fields to update"});
        }

        if(hasSchoolName){
            const trimmed = schoolName.trim();
            if(trimmed.length === 0){
                return res.status(400).json({error: "Must enter school name"});
            }
            updates.schoolName = trimmed;
        }

        const normalized = hasGradeLevels ? normalizeGradeLevels(gradeLevels) : [];

        const result = await db.transaction(async (tx) => {
            let schoolRow: {id: string, schoolName: string} | undefined;

            if(Object.keys(updates).length > 0){
                const [updated] = await tx
                    .update(schools)
                    .set(updates)
                    .where(eq(schools.id, schoolId))
                    .returning({id: schools.id, schoolName: schools.schoolName});
                schoolRow = updated;
            } else{
                const [existing] = await tx
                    .select({id: schools.id, schoolName: schools.schoolName})
                    .from(schools)
                    .where(eq(schools.id, schoolId))
                    .limit(1);
                schoolRow = existing;
            }

            if(!schoolRow) return null;

            if(hasGradeLevels){
                await tx
                    .delete(schoolGradeLevels)
                    .where(eq(schoolGradeLevels.schoolId, schoolId));

                if(normalized.length > 0){
                    const rows: NewSchoolGradeLevel[] = normalized.map(
                        (gradeLevel) => ({
                            id: randomUUID(), 
                            schoolId: schoolId, 
                            gradeLevel: gradeLevel
                        }),
                    );
                    await tx.insert(schoolGradeLevels).values(rows);
                }
            }

            const gradeLevels = await tx
                .select({gradeLevel: schoolGradeLevels.gradeLevel})
                .from(schoolGradeLevels)
                .where(eq(schoolGradeLevels.schoolId, schoolId));

            return {
                ...schoolRow, 
                gradeLevels: gradeLevels.map((g) => g.gradeLevel),
            };
        });

        if(!result){
            return res.status(404).json({error: "School not found"});
        }
        return res.status(200).json({
            data: result
        });
    } catch (error) {
        console.error("PATCH /schools/:id error: ", error);
        return res.status(500).json({error: "Failed to update school"});
    }
})