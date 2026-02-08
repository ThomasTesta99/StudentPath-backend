import express from "express";
import { departments, NewDepartment, schools } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";

export const departmentsRouter = express.Router();

departmentsRouter.post("/", async (req, res) => {
    try {
        const {name, schoolId} = req.body;

        const newDepartment: NewDepartment = {
            id: randomUUID(),
            name: name.trim(),
            schoolId: schoolId,
        };

        const [result] = await db
            .insert(departments)
            .values(newDepartment)
            .returning()

        if(!result){
            return res.status(400).json({error: "There was an error creating the department"})
        }

        return res.status(200).json({data: result});
    } catch (error) {
        console.error("POST departments error: ", error);
        return res.status(500).json({error: "There was an error creating the department"});
    }
})

departmentsRouter.get("/", async (req,res)=> {
    try {
        const {search, page = 1, limit = 10, schoolId} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        filterConditions.push(eq(departments.schoolId, String(schoolId)));

        if(search){
            const s = String(search).trim();
            if(s.length > 0){
                filterConditions.push(
                    ilike(departments.name, `%${s}%`),
                )
            }
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const departmentsCount = await db
            .select({count: sql<number>`count(*)`})
            .from(departments)
            .innerJoin(schools, eq(schools.id, departments.schoolId))
            .where(whereClause);

        const totalCount = departmentsCount[0]?.count ?? 0;

        const departmentsList = await db
            .select({
                ...getTableColumns(departments),
                school: {
                    ...getTableColumns(schools)
                }
            })
            .from(departments)
            .innerJoin(schools, eq(departments.schoolId, schools.id))
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(departments.createdAt));


        return res.status(200).json({
            data: departmentsList, 
            pagination: {
                page: currentPage, 
                limit: limitPerPage, 
                total: totalCount, 
                totalPages: Math.ceil(totalCount / limitPerPage)
            }
        })
    } catch (error) {
        console.error("GET /departments error: ", error);
        return res.status(500).json({error: "There was an error getting the departments"})
    }
})