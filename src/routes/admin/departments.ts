import express from "express";
import { departments, NewDepartment } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";

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