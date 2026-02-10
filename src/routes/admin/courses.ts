import express from "express"
import { courses, departments, NewCourse, schools, teacherProfiles, terms, user } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { getSchoolIdForAdmin } from "../../lib/utils";

export const coursesRouter = express.Router();

coursesRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
        const {termId, teacherId, departmentId, name, gradeLevel, code, description} = req.body;

        const required = {schoolId, termId, teacherId, departmentId, name, gradeLevel, code, description};
        for(const [k,v] of Object.entries(required)){
            if(typeof v !== "string" || v.trim().length === 0){
                return res.status(400).json({error: `${k} is required`});
            }
        }
        const newCourse: NewCourse = {
            id: randomUUID(), 
            schoolId: schoolId.trim(), 
            termId: termId.trim(), 
            teacherId: teacherId.trim(), 
            departmentId: departmentId.trim(), 
            name: name.trim(), 
            gradeLevel: gradeLevel.trim(), 
            code: code.trim(), 
            description: description.trim(),
        };

        const [school] = await db
            .select({id: schools.id})
            .from(schools)
            .where(eq(schools.id, newCourse.schoolId))
            .limit(1);
        if(!school) return res.status(400).json({error: "Invalid school"});

        const [term] = await db
            .select({id: terms.id, schoolId: terms.schoolId})
            .from(terms)
            .where(eq(terms.id, newCourse.termId))
            .limit(1);
        if(!term) return res.status(400).json({error: "Invalid term"});
        if(term.schoolId !== newCourse.schoolId) return res.status(400).json({error: "Term does not belong to this school"});

        const [department] = await db
            .select({id: departments.id, schoolId: departments.schoolId})
            .from(departments)
            .where(eq(departments.id, newCourse.departmentId))
            .limit(1);
        if(!department) return res.status(400).json({error: "Invalid department"});
        if(department.schoolId !== newCourse.schoolId) return res.status(400).json({error: "Department does not belong to this school"});
        
        const [teacher] = await db
            .select({id: user.id, role: user.role})
            .from(user)
            .where(eq(user.id, newCourse.teacherId))
            .limit(1);
        if(!teacher) return res.status(400).json({error: "Invalid teacherId"});
        if(teacher.role !== "teacher"){
            return res.status(400).json({error: "User must be a teacher to be assinged a course instructor."});
        }
        

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
        const {search, page = 1, limit = 10} = req.query;
        
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        if (!schoolId || String(schoolId).trim().length === 0) {
            return res.status(400).json({ error: "schoolId is required" });
        }
        filterConditions.push(eq(courses.schoolId, String(schoolId)));

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

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(courses)
            .where(whereClause);
        
        const totalCount = countResult[0]?.count ?? 0;

        const courseList = await db
            .select({
                ...getTableColumns(courses), 
                school: {
                    ...getTableColumns(schools)
                },
                term: {
                    ...getTableColumns(terms)
                },
                department: {
                    ...getTableColumns(departments)
                }, 
                teacher: {
                    ...getTableColumns(user)
                }
            })
            .from(courses)
            .innerJoin(schools, eq(courses.schoolId, schools.id))
            .innerJoin(terms, eq(courses.termId, terms.id))
            .innerJoin(departments, eq(courses.departmentId, departments.id))
            .innerJoin(user, eq(courses.teacherId, user.id))
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
                term: {
                    ...getTableColumns(terms)
                },
                department: {
                    ...getTableColumns(departments)
                },
                teacher: {
                    ...getTableColumns(user)
                }
            })
            .from(courses)
            .innerJoin(schools, eq(courses.schoolId, schools.id))
            .innerJoin(terms, eq(courses.termId, terms.id))
            .innerJoin(departments, eq(courses.departmentId, departments.id))
            .innerJoin(user, eq(courses.teacherId, user.id))
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .limit(1);

        if(!course){
            return res.status(404).json({error: "There was an error getting the course"})
        }

        return res.status(200).json({course: course});
    } catch (error) {
        console.error("GET /courses/id error: ", error);
        return res.status(500).json({error: "There was an error getting the course"});
    }
})

coursesRouter.patch("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const {termId, teacherId, departmentId, name, gradeLevel, code, description} = req.body;

        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const updates: Partial<NewCourse> = {};

        if(typeof termId === "string" && termId.trim().length > 0) updates.termId = termId.trim();
        if(typeof teacherId === "string" && teacherId.trim().length > 0) updates.teacherId = teacherId.trim();
        if(typeof departmentId === "string" && departmentId.trim().length > 0) updates.departmentId = departmentId.trim();
        if(typeof name === "string" && name.trim().length > 0) updates.name = name.trim();
        if(typeof gradeLevel === "string" && gradeLevel.trim().length > 0) updates.gradeLevel = gradeLevel.trim();
        if(typeof code === "string" && code.trim().length > 0) updates.code = code.trim();
        if(typeof description === "string"  && description.trim().length > 0) updates.description = description.trim();

        if(Object.keys(updates).length === 0){
            return res.status(400).json({error: "No valid fields to update"});
        }

        const [existingCourse] = await db
            .select({id: courses.id})
            .from(courses)
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .limit(1);

        if(!existingCourse) return res.status(404).json({error: "Course not found"});

        if(updates.termId){
            const [term] = await db.select({id: terms.id}).from(terms).where(eq(terms.id, updates.termId)).limit(1);;
            if(!term) return res.status(404).json({error: "invalid Term"});
        }

        if(updates.departmentId){
            const [department] = await db.select({id: departments.id}).from(departments).where(eq(departments.id, updates.departmentId)).limit(1);;
            if(!department) return res.status(404).json({error: "invalid department"});
        }

        if(updates.teacherId){
            const [teacher] = await db.select({id: teacherProfiles.userId}).from(teacherProfiles).where(eq(teacherProfiles.userId, updates.teacherId)).limit(1);;
            if(!teacher) return res.status(404).json({error: "Invalid teacher"})
        }

        const [updated] = await db
            .update(courses)
            .set(updates)
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .returning();

        if(!updated) return res.status(400).json({error: "There was an error updating the course"});

        return res.status(200).json({course: updated});
    } catch (error) {
        console.error("PATCH /courses error: ", error);
        return res.status(500).json({error: "There was an error updating the course"});
    }
})

coursesRouter.delete("/:id", async (req, res) => {
    try {
        const {id} = req.params;
        const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });


        const [deleted] = await db
            .delete(courses)
            .where(and(eq(courses.id, id), eq(courses.schoolId, schoolId)))
            .returning({id: courses.id, name: courses.name, code: courses.code});

        if(!deleted) return res.status(404).json({error: "Course not found"});

        return res.status(200).json({deletedCourse: deleted});
    } catch (error) {
        console.error("DELETE /courses error: ", error);
        return res.status(500).json({error: "There was an error deleting the course"});
    }
})