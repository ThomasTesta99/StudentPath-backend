import express from "express"

export const coursesRouter = express.Router();

coursesRouter.post("/", async (req, res) => {
    try {
        const {schoolId, termId, teacherId, name, gradeLevel, departmentId, code, description} = req.body;
    } catch (error) {
        console.error("POST course error: ", error);
        return res.status(500).json({error: "There was an error creating the course"});
    }
})