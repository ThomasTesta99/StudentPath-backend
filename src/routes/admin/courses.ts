import express from "express"
import { courses, departments, NewCourse, schools } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { getSchoolIdForAdmin, parseGradeLevel } from "../../lib/utils";

export const coursesRouter = express.Router();

coursesRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        const {departmentId, name, gradeLevel, code, description} = req.body;

        const required = {schoolId, departmentId, name, code, description};
        for(const [k,v] of Object.entries(required)){
            if(typeof v !== "string" || v.trim().length === 0){
                return res.status(400).json({error: `${k} is required`});
            }
        }

        const parsedGradeLevel = parseGradeLevel(gradeLevel);

        const newCourse: NewCourse = {
            id: randomUUID(), 
            schoolId: schoolId.trim(), 
            departmentId: departmentId.trim(), 
            name: name.trim(), 
            gradeLevel: parsedGradeLevel, 
            code: code.trim(), 
            description: description.trim(),
        };

        const [school] = await db
            .select({id: schools.id})
            .from(schools)
            .where(eq(schools.id, newCourse.schoolId))
            .limit(1);
        if(!school) return res.status(400).json({error: "Invalid school"});

        const [department] = await db
            .select({id: departments.id, schoolId: departments.schoolId})
            .from(departments)
            .where(eq(departments.id, newCourse.departmentId))
            .limit(1);
        if(!department) return res.status(400).json({error: "Invalid department"});
        if(department.schoolId !== newCourse.schoolId) return res.status(400).json({error: "Department does not belong to this school"});
    
        const result = await db
            .insert(courses)
            .values(newCourse)
            .returning();

        if(!result[0]){
            return res.status(400).json({error: "An error occured creating the course"});
        }

        return res.status(201).json({
            data: result[0]
        })
    } catch (error) {
        console.error("POST course error: ", error);
        return res.status(500).json({error: "There was an error creating the course"});
    }
})

coursesRouter.get("/", async (req ,res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        const {search, page = 1, limit = 10, departmentId} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        filterConditions.push(eq(courses.schoolId, String(schoolId)));
        
        if(departmentId){
            filterConditions.push(eq(courses.departmentId, String(departmentId)));
        }

        if(search){
            const s = String(search).trim();
            if(s.length > 0){
                filterConditions.push(
                    or(
                        ilike(courses.name, `%${s}%`),
                        ilike(courses.code, `%${s}%`),
                    )
                )
            }
        }

        const whereClause = and(...filterConditions);

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(courses)
            .where(whereClause);
        
        const totalCount = countResult[0]?.count ?? 0;

        const courseList = await db
            .select({
                ...getTableColumns(courses), 
                school: {
                    schoolName: schools.schoolName
                },
                department: {
                    ...getTableColumns(departments)
                }, 
            })
            .from(courses)
            .innerJoin(schools, eq(courses.schoolId, schools.id))
            .innerJoin(departments, eq(courses.departmentId, departments.id))
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(courses.createdAt));

        return res.status(200).json({
            data: courseList, 
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }, 
        })
    } catch (error) {
        console.error("GET /courses error: ", error);
        return res.status(500).json({error: "There was an error getting all courses"});
    }
})

coursesRouter.get("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const [course] = await db
            .select({
                ...getTableColumns(courses),
                school: {
                    ...getTableColumns(schools)
                }, 
                department: {
                    ...getTableColumns(departments)
                },
            })
            .from(courses)
            .innerJoin(schools, eq(courses.schoolId, schools.id))
            .innerJoin(departments, eq(courses.departmentId, departments.id))
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .limit(1);

        if(!course){
            return res.status(404).json({error: "There was an error getting the course"})
        }

        return res.status(200).json({data: course});
    } catch (error) {
        console.error("GET /courses/id error: ", error);
        return res.status(500).json({error: "There was an error getting the course"});
    }
})

coursesRouter.patch("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const {departmentId, name, code, description, gradeLevel} = req.body;

        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const updates: Partial<NewCourse> = {};

        if(typeof departmentId === "string" && departmentId.trim().length > 0) updates.departmentId = departmentId.trim();
        if(typeof name === "string" && name.trim().length > 0) updates.name = name.trim();
        if(typeof code === "string" && code.trim().length > 0) updates.code = code.trim();
        if(typeof description === "string"  && description.trim().length > 0) updates.description = description.trim();
        if(typeof gradeLevel === "string" && gradeLevel.trim().length > 0) {
            updates.gradeLevel = parseGradeLevel(gradeLevel);
        }

        if(Object.keys(updates).length === 0){
            return res.status(400).json({error: "No valid fields to update"});
        }

        const [existingCourse] = await db
            .select({id: courses.id})
            .from(courses)
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .limit(1);

        if(!existingCourse) return res.status(404).json({error: "Course not found"});

        if(updates.departmentId){
            const [department] = await db.select({id: departments.id}).from(departments).where(and(eq(departments.id, updates.departmentId), eq(departments.schoolId, schoolId))).limit(1);;
            if(!department) return res.status(404).json({error: "invalid department/does not belong to this school"});
        }

        const [updated] = await db
            .update(courses)
            .set(updates)
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .returning();

        if(!updated) return res.status(400).json({error: "There was an error updating the course"});

        return res.status(200).json({data: updated});
    } catch (error) {
        console.error("PATCH /courses error: ", error);
        return res.status(500).json({error: "There was an error updating the course"});
    }
})

coursesRouter.delete("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        
        const {id} = req.params;

        const [deleted] = await db
            .delete(courses)
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .returning({id: courses.id, name: courses.name, code: courses.code});

        if(!deleted) return res.status(404).json({error: "Course not found"});

        return res.status(200).json({data: deleted});
    } catch (error) {
        console.error("DELETE /courses error: ", error);
        return res.status(500).json({error: "There was an error deleting the course"});
    }
})