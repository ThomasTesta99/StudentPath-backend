import express from 'express';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { NewSchool, School, schools } from '../../db/schema';
import { db } from '../../db';
import { randomUUID } from 'crypto';

export const schoolsRouter = express.Router();

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

schoolsRouter.patch("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const {schoolName} = req.body;

        const updates: Partial<NewSchool> = {};

        if(typeof schoolName === "string"){
            const trimmed = schoolName.trim();
            if(trimmed.length === 0){
                return res.status(400).json({error: "Must enter school name"});
            }
            updates.schoolName = trimmed;
        }

        if(Object.keys(updates).length === 0){
            return res.status(400).json({error: "No valid fields to update"});
        }

        const [updated] = await db
            .update(schools)
            .set(updates)
            .where(eq(schools.id, id))
            .returning({id: schools.id, schoolName: schools.schoolName});

        if(!updated){
            return res.status(404).json({error: "School not found"});
        }

        return res.status(200).json({data: updated});
    } catch (error) {
        console.error("PATCH /schools/:id error: ", error);
        return res.status(500).json({error: "Failed to update school"});
    }
})