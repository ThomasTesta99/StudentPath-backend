import express from 'express';
import { and, desc, ilike, or, sql } from 'drizzle-orm';
import { School, schools } from '../../db/schema';
import { db } from '../../db';

export const schoolsRouter = express.Router();

schoolsRouter.get("/", async (req, res) => {
    try {
        const {search, page = 1, limit = 10} = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
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
})