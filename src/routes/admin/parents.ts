import express from "express"
import { getSchoolIdForAdmin } from "../../lib/utils";
import { auth } from "../../lib/auth";
import { NewParentProfile, NewUser, parentProfiles, user } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, eq, getTableColumns } from "drizzle-orm";

export const adminParentsRouter = express.Router();

adminParentsRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {name, email, password} = req.body;

        const result = await auth.api.createUser({
            body: {
                name, 
                email,
                password, 
                role: "user", 
                data: {profileRole: "parent"}
            },
            headers: req.headers
        })

        if(!result.user){
            return res.status(400).json({error: "There was an error creating the user"});
        }

        const createdUser = result.user;

        const newParentProfile: NewParentProfile = {
            userId: createdUser.id,
            schoolId: schoolId, 
        }
        
        const [createdProfile] = await db
            .insert(parentProfiles)
            .values(newParentProfile)
            .returning();

        if(!createdProfile){
            await auth.api.removeUser({
                body:{
                    userId: createdUser.id,
                },
                headers: req.headers
            })
            return res.status(400).json({error: "There was an error creating a parent profile"});
        }

        return res.status(201).json({data: {createdUser: createdUser, profile: createdProfile}})
    } catch (error) {
        console.error("POST /create-parent error: ", error);
        return res.status(500).json({error: "There was an error creating the parent"});
    }
})

adminParentsRouter.get("/", async (req, res) => {
    try {
        
    } catch (error) {
        
    }
})

adminParentsRouter.get("/:userId", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {userId} = req.params;

        const [parent] = await db
            .select({
                ...getTableColumns(user),
                profile: {
                    ...getTableColumns(parentProfiles)
                }
            })
            .from(parentProfiles)
            .innerJoin(user, eq(parentProfiles.userId, user.id))
            .where(and(eq(parentProfiles.userId, userId), eq(parentProfiles.schoolId, schoolId)))
            .limit(1);

        if(!parent){
            return res.status(400).json("There was an error getting the parent");
        }

        return res.status(200).json({data: parent});
    } catch (error) {
        console.error("GET /parents error: ", error);
        return res.status(500).json({error: "There was an error getting the parent"});
    }
})