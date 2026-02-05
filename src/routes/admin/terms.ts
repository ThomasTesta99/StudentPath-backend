import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import express from 'express'
import { NewTerm, terms } from '../../db/schema';
import { db } from '../../db';
import { randomUUID } from 'crypto';

export const termsRouter = express.Router();

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  const s = String(value).toLowerCase().trim();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return undefined; // invalid -> ignore
}

termsRouter.get("/", async (req, res) => {
    try {
        const {search, page = 1, limit = 10, active} = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if(search){
            filterConditions.push(
                ilike(terms.termName, `%${search}%`)
            )
        }

        const activeBool = parseBooleanQuery(active);
        if (activeBool !== undefined) {
        filterConditions.push(eq(terms.isActive, activeBool));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(terms)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const termsList = await db  
            .select()
            .from(terms)
            .where(whereClause)
            .orderBy(desc(terms.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        return res.status(200).json({
            data: termsList, 
            pagination: {
                page: currentPage, 
                limit: limitPerPage,
                total: totalCount, 
                totalPages: Math.ceil(totalCount / limitPerPage), 
            }
        });
    } catch (error) {
        console.error("GET /terms error: ", error);
        res.status(500).json({error: "There was an error getting terms"});
    }
})

termsRouter.post("/", async (req,res) => {
    try {
        const {schoolId, termName, startDate, endDate} = req.body;

        const start = new Date(startDate);
        const end = new Date(endDate);

        if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime)){
            return res.status(400).json({error: "Must enter valid dates"});
        }

        if(start > end){
            return res.status(400).json({error: "Start date must be before end date"});
        }

        const newTerm: NewTerm = {
            id: randomUUID(), 
            schoolId, 
            termName, 
            startDate: start, 
            endDate: end,
            isActive: false, 
        }

        const [createdTerm] = await db
            .insert(terms)
            .values(newTerm)
            .returning()

        return res.status(201).json({data: createdTerm});
    } catch (error) {
        console.error("POST /terms error: ", error);
        res.status(500).json({error: "There was an error creating the term."});
    }
});