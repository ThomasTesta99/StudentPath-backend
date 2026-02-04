import express from 'express';
import { and, desc, ilike, sql } from 'drizzle-orm';
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

        res.status(200).json({
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

        res.status(201).json({
            data: createdSchool
        })
    } catch (error) {
        console.error("POST /schools error: ", error);
        res.status(500).json({error: "Failed to create a school"});
    }
});