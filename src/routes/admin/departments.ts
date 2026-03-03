import express from "express";
import { courses, departments, NewDepartment, schools } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, ne, sql } from "drizzle-orm";
import { getSchoolIdForAdmin } from "../../lib/utils";

export const departmentsRouter = express.Router();

departmentsRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        
        let {name, code} = req.body;
        if (typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ error: "name is required" });
        }
        if(typeof name !== "string" || name.trim().length === 0 || name.trim().length > 3){
            return res.status(400).json({error: "Department code requirements not met."});
        }

        name = name.trim().toUpperCase();

        const newDepartment: NewDepartment = {
            id: randomUUID(),
            name: name,
            code: code,
            schoolId,
        };

        const [result] = await db
            .insert(departments)
            .values(newDepartment)
            .returning()

        if(!result){
            return res.status(400).json({error: "There was an error creating the department"})
        }

        return res.status(201).json({data: result});
    } catch (error) {
        console.error("POST departments error: ", error);
        return res.status(500).json({error: "There was an error creating the department"});
    }
})

departmentsRouter.get("/", async (req,res)=> {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        const {search, page = 1, limit = 10} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        filterConditions.push(eq(departments.schoolId, schoolId));

        if(search){
            const s = String(search).trim();
            if(s.length > 0){
                filterConditions.push(
                    ilike(departments.name, `%${s}%`),
                    ilike(departments.code, `%${s}%`),
                )
            }
        }

        const whereClause = and(...filterConditions);

        const departmentsCount = await db
            .select({count: sql<number>`count(*)`})
            .from(departments)
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

departmentsRouter.get("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
    
        const { id } = req.params;
    
        const [department] = await db
          .select({
            ...getTableColumns(departments),
            school: {
                schoolName: schools.schoolName
            }
          })
          .from(departments)
          .innerJoin(schools, eq(departments.schoolId, schoolId))
          .where(and(eq(departments.id, id), eq(departments.schoolId, schoolId)))
          .limit(1);
    
        if (!department) return res.status(404).json({ error: "Department not found" });
    
        return res.status(200).json({ data: department });
      } catch (error) {
        console.error("GET /departments/:id error:", error);
        return res.status(500).json({ error: "There was an error getting the department" });
      }
})

departmentsRouter.patch("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const {name, code} = req.body;

        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const updates: Partial<NewDepartment> = {};

        if(typeof name === "string"){
            const trimmed = name.trim();
            if(trimmed.length === 0){
                return res.status(400).json({error: "Must enter department name"});
            }
            updates.name = trimmed;
        }
        if(typeof code === "string"){
            if(code.trim().length === 0 || code.trim().length > 3){
                return res.status(400).json({error: "Department code requirements not met."});
            }
            updates.code = code.trim();
        }
        

        if(Object.keys(updates).length === 0){
            return res.status(400).json({error: "No valid fields to update"});
        }

        const [existingDept] = await db
            .select({ id: departments.id, schoolId: departments.schoolId })
            .from(departments)
            .where(and(eq(departments.id, id), eq(departments.schoolId, schoolId)))
            .limit(1);

        if (!existingDept) {
            return res.status(404).json({ error: "Department not found" });
        }

        if (updates.name) {
            const [duplicate] = await db
                .select({ id: departments.id })
                .from(departments)
                .where(
                and(
                    eq(departments.schoolId, existingDept.schoolId),
                    ilike(departments.name, updates.name), 
                    ne(departments.id, id)
                )
                )
                .limit(1);

            if (duplicate) {
                return res.status(409).json({
                error: "A department with that name already exists in this school",
                });
            }
        }

        const [updated] = await db
            .update(departments)
            .set(updates)
            .where(and(eq(departments.id, id), eq(departments.schoolId, schoolId)))
            .returning();

        if(!updated){
            return res.status(404).json({error: "Department not found"});
        }

        return res.status(200).json({data: updated});
    } catch (error) {
        console.error("PATCH /departments error: ", error);
        return res.status(500).json({error: "There was an error updating the department"});
    }
} )

departmentsRouter.delete("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) {
            return res.status(401).json({ error: "Not authorized" });
        }

        const { id } = req.params;

        const [existingDept] = await db
            .select({
                id: departments.id,
                schoolId: departments.schoolId,
                name: departments.name,
            })
            .from(departments)
            .where(and(eq(departments.id, id), eq(departments.schoolId, schoolId)))
            .limit(1);

        if (!existingDept) {
            return res.status(404).json({ error: "Department not found" });
        }

        const [linkedCourse] = await db
            .select({ id: courses.id })
            .from(courses)
            .where(eq(courses.departmentId, id))
            .limit(1);

        if (linkedCourse) {
            return res.status(409).json({
                error: "Cannot delete this department because it still has courses assigned to it",
            });
        }

        const [deletedDepartment] = await db
            .delete(departments)
            .where(and(eq(departments.id, id), eq(departments.schoolId, schoolId)))
            .returning();

        if (!deletedDepartment) {
            return res.status(404).json({ error: "Department not found" });
        }

        return res.status(200).json({
            data: deletedDepartment,
        });
    } catch (error) {
        console.error("DELETE /departments/:id error:", error);
        return res.status(500).json({
            error: "There was an error deleting the department",
        });
    }
});