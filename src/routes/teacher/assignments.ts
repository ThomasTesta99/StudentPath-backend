import express from "express";
import { getTeacherInformation, requireAssignmentType, requireDateString, requirePositiveInt, requireStringArray, requireTrimmedString } from "../../lib/utils";
import { db } from "../../db";
import { assignments, NewAssignment, sections } from "../../db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const teacherAssignmentsRouter = express.Router();

teacherAssignmentsRouter.post("/", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        }

        const title = requireTrimmedString(req.body.title, "title");
        const description = requireTrimmedString(req.body.description, "description");
        const pointsPossible = requirePositiveInt(req.body.pointsPossible, "pointsPossible");
        const dueDate = requireDateString(req.body.dueDate, "dueDate");
        const type = requireAssignmentType(req.body.type, "type");
        const sectionIds = requireStringArray(req.body.sectionIds, "sectionIds");

        if(sectionIds.length === 0){
            return res.status(400).json({error: "At least one section must be selected"});
        }

        const teacherSections = await db
            .select({
                id: sections.id, 
                courseId: sections.courseId, 
                teacherId: sections.teacherId
            })
            .from(sections)
            .where(
                and(
                    inArray(sections.id, sectionIds),
                    eq(sections.teacherId, teacher.userId)
                )
            );

        if(teacherSections.length !== sectionIds.length){
            return res.status(403).json({error: "One or more selected sections do not belong to this teacher"})
        }

        const uniqueCourseIds = [...new Set(teacherSections.map((section) => section.courseId))];

        if(uniqueCourseIds.length !== 1){
            return res.status(400).json({error: "All selected sections must belong to the same course"});
        }

        let assignmentGroupId: string | null = null;

        if(teacherSections.length > 1){
            assignmentGroupId = crypto.randomUUID();
        }

        const createdAssignments = await db.transaction(async (tx) => {
            return await tx
                .insert(assignments)
                .values(
                    teacherSections.map((section) => ({
                        id: crypto.randomUUID(), 
                        sectionId: section.id, 
                        title, 
                        description, 
                        dueDate, 
                        pointsPossible, 
                        type, 
                        assignmentGroupId: assignmentGroupId
                    } ))
                )
                .returning();
        })
        
        return res.status(201).json({
            data: createdAssignments
        })
        
    } catch (error) {
        console.error("POST /assignments error: ", error);
        return res.status(500).json({error: "There was an error creating the assignment"});
    }
})

teacherAssignmentsRouter.patch("/:assignmentId", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        };

        const {assignmentId} = req.params;
        const allSections = req.body.allSections === true;

        const [existingAssignment] = await db
            .select({
                id: assignments.id, 
                sectionId: assignments.sectionId, 
                assignmentGroupId: assignments.assignmentGroupId,
                teacherId: sections.teacherId, 
            })
            .from(assignments)
            .innerJoin(sections, eq(assignments.sectionId, sections.id))
            .where(eq(assignments.id, assignmentId))
            .limit(1);

        if(!existingAssignment){
            return res.status(404).json({error: "Assignment not found"});
        }

        if(existingAssignment.teacherId !== teacher.userId){
            return res.status(403).json({error: "Teacher does not own this assignment"});
        }

        const updates: Partial<NewAssignment> = {};

        if(req.body.title !== undefined) updates.title = requireTrimmedString(req.body.title, "title");
        if(req.body.description !== undefined) updates.description = requireTrimmedString(req.body.description, "description");
        if(req.body.dueDate !== undefined) updates.dueDate = requireDateString(req.body.dueDate, "dueDate");
        if(req.body.pointsPossible !== undefined) updates.pointsPossible = requirePositiveInt(req.body.pointsPossible, "pointsPossible");
        if(req.body.type !== undefined) updates.type = requireAssignmentType(req.body.type, "type");

        if(Object.keys(updates).length === 0){
            return res.status(400).json({error: "Nothing to update"});
        }

        if(allSections){
            if(!existingAssignment.assignmentGroupId){
                return res.status(400).json({error: "This assignment is not for multiple sections."});
            }

            const groupAssignments = await db
                .select({
                    id: assignments.id, 
                    teacherId: sections.teacherId
                })
                .from(assignments)
                .innerJoin(sections, eq(assignments.sectionId, sections.id))
                .where(eq(assignments.assignmentGroupId, existingAssignment.assignmentGroupId));

                const teacherOwnsAll = groupAssignments.every(
                    (assignment) => assignment.teacherId === teacher.userId
                )

                if(!teacherOwnsAll){
                    return res.status(403).json({error: "You do not have permission to update all linked assignments"});
                }

                const updatedAssignments = await db
                    .update(assignments)
                    .set(updates)
                    .where(eq(assignments.assignmentGroupId, existingAssignment.assignmentGroupId))
                    .returning();
                
                return res.status(200).json({
                    data: updatedAssignments
                });
        }

        const [updatedAssignment] = await db 
            .update(assignments)
            .set(updates)
            .where(eq(assignments.id, assignmentId))
            .returning();

        return res.status(200).json({data: updatedAssignment});
    } catch (error) {
        console.error("/PATCH /asignment error: ", error);
        return res.status(500).json({error: "There was an error updating the assingment"});
    }
})

teacherAssignmentsRouter.delete("/:assignmentId", async (req, res) => {
    try {
        const teacher = await getTeacherInformation(req);
        if(!teacher){
            return res.status(401).json({error: "Not authorized"});
        };

        const {assignmentId} = req.params;

        const [existingAssignment] = await db
            .select({
                id: assignments.id, 
                sectionId: assignments.sectionId, 
                assignmentGroupId: assignments.assignmentGroupId,
                teacherId: sections.teacherId, 
            })
            .from(assignments)
            .innerJoin(sections, eq(assignments.sectionId, sections.id))
            .where(eq(assignments.id, assignmentId))
            .limit(1);

        if(!existingAssignment){
            return res.status(404).json({error: "Assignment not found"});
        }

        if(existingAssignment.teacherId !== teacher.userId){
            return res.status(403).json({error: "Teacher does not own this assignment"});
        }

        const [deleted] = await db
            .delete(assignments)
            .where(eq(assignments.id, assignmentId))
            .returning();

        if(!deleted){
            return res.status(400).json({error: "An error occured deleting the assignment"});
        }

        return res.status(200).json({data: deleted});
    } catch (error) {
        console.error("DELETE /assignment error: ", error);
        return res.status(500).json({error: "There was an error deleting the assignment"});
    }
})