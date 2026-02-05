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

termsRouter.patch("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const {termName, startDate, endDate} = req.body;

        const updates : Partial<NewTerm> = {};

        if(typeof termName === "string"){
            const trimmed = termName.trim();
            if(trimmed.length === 0){
                return res.status(400).json({error: "Must enter school name"});
            }
            updates.termName = trimmed;
        }

        let parsedStart: Date | undefined;
        let parsedEnd: Date | undefined;

        if (startDate !== undefined) {
            const d = new Date(String(startDate));
            if (Number.isNaN(d.getTime())) {
                return res.status(400).json({ error: "startDate must be a valid date" });
            }
            parsedStart = d;
            updates.startDate = d;
        }

        if (endDate !== undefined) {
            const d = new Date(String(endDate));
            if (Number.isNaN(d.getTime())) {
                return res.status(400).json({ error: "endDate must be a valid date" });
            }
            parsedEnd = d;
            updates.endDate = d;
        }

        if(Object.keys(updates).length === 0){
            return res.status(400).json({error: "No valid fields to update"});
        }

        if(parsedStart && parsedEnd){
            if(parsedStart > parsedEnd){
                return res.status(400).json({ error: "startDate must be before endDate" });
            }
        } else if (parsedStart || parsedEnd) {
            const [existing] = await db
                .select({ startDate: terms.startDate, endDate: terms.endDate })
                .from(terms)
                .where(eq(terms.id, id))
                .limit(1);

            if (!existing) {
                return res.status(404).json({ error: "Term not found" });
            }

            const finalStart = parsedStart ?? existing.startDate;
            const finalEnd = parsedEnd ?? existing.endDate;

            if (finalStart > finalEnd) {
                return res.status(400).json({ error: "startDate must be before endDate" });
            }
        }

        const [updated] = await db
            .update(terms)
            .set(updates)
            .returning();

        if(!updated){
            return res.status(404).json({error: "School not found"});
        }

        return res.status(200).json({data: updated});
    } catch (error) {
        console.error("PATCH /terms error: ", error);
        return res.status(500).json({error: "There was an error updating the term"});
    }
})

termsRouter.patch("/:id/activate", async (req, res) => {
    try {
        const {id} = req.params;

        const [activated] = await db
            .update(terms)
            .set({isActive: true})
            .returning({termName:terms.termName, isActive: terms.isActive});

        if(!activated?.isActive){
            return res.status(400).json({error : "There was an error activating the term"});
        }

        return res.status(200).json({data: activated, message: `Term: ${activated.termName} has been activated: ${activated.isActive}`});
    } catch (error) {
        console.error("PATCH /activate error: ", error);
        return res.status(500).json({error: "There was an error activating the term"});
    }
})