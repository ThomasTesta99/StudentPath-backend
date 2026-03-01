import express from "express"
import { getSchoolIdForAdmin } from "../../lib/utils";
import { auth } from "../../lib/auth";
import { NewParentInvite, NewParentProfile, NewUser, parentInvites, parentProfiles, schools, studentProfiles, User, user } from "../../db/schema";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { generateInviteToken, hashToken } from "../../lib/invite";

export const adminParentsRouter = express.Router();

adminParentsRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {name, email, password} = req.body;

        if (!name || typeof name !== "string") {
            return res.status(400).json({ error: "name is required" });
        }
        if (!email || typeof email !== "string") {
            return res.status(400).json({ error: "email is required" });
        }
        if (!password || typeof password !== "string") {
            return res.status(400).json({ error: "password is required" });
        }

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
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {search, page = 1, limit = 10, gradeLevel} = req.query;
                
        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];
        filterConditions.push(eq(parentProfiles.schoolId, schoolId));

        if(search){
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`),
                )
            )
        }

        const whereClause = and(...filterConditions);

        const countResult = await db
            .select({count: sql<number>`count(*)`})
            .from(parentProfiles)
            .innerJoin(user, eq(parentProfiles.userId, user.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const parentList = await db
            .select({
                ...getTableColumns(parentProfiles),
                user: {
                    ...getTableColumns(user)
                },
            })
            .from(parentProfiles)
            .innerJoin(user, eq(parentProfiles.userId, user.id))
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(parentProfiles.createdAt));

        return res.status(200).json({
            data: parentList, 
            pagination: {
                page: currentPage, 
                limit: limitPerPage, 
                total: totalCount, 
                totalPages: Math.ceil(totalCount / limitPerPage)
            },
        })
    } catch (error) {
        console.error("GET /parents error: ", error);
        return res.status(500).json({error: "There was an error getting the parents"});
    }
})

adminParentsRouter.get("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {id} = req.params;

        const [parent] = await db
            .select({
                ...getTableColumns(parentProfiles),
                user: {
                    ...getTableColumns(user)
                }
            })
            .from(parentProfiles)
            .innerJoin(user, eq(parentProfiles.userId, user.id))
            .where(and(eq(parentProfiles.userId, id), eq(parentProfiles.schoolId, schoolId)))
            .limit(1);

        if(!parent){
            return res.status(400).json({error: "There was an error getting the parent"});
        }

        return res.status(200).json({data: parent});
    } catch (error) {
        console.error("GET /parents error: ", error);
        return res.status(500).json({error: "There was an error getting the parent"});
    }
})

adminParentsRouter.delete("/:id", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const { id } = req.params;

        const [existing] = await db
            .select({ userId: parentProfiles.userId })
            .from(parentProfiles)
            .where(
                and(
                    eq(parentProfiles.userId, id),
                    eq(parentProfiles.schoolId, schoolId)
                )
            )
            .limit(1);

        if (!existing) {
            return res.status(400).json({ error: "No parent profile found" });
        }

        const deleteUser = await auth.api.removeUser({
            body: {
                userId: id,
            },
            headers: req.headers,
        });

        if (deleteUser.success) {
            return res.status(200).json({
                message: `Successfully deleted user ${id}`,
            });
        } else {
            return res.status(400).json({ error: "Failed to delete parent." });
        }
    } catch (error) {
        console.error("DELETE /parents error: ", error);
        return res.status(500).json({ error: "There was an error deleting the parent" });
    }
});

adminParentsRouter.patch("/:id", async (req, res) => {
  try {
    const schoolId = await getSchoolIdForAdmin(req);
    if (!schoolId) return res.status(401).json({ error: "Not authorized" });

    const { id } = req.params;
    const { name, email } = req.body;

    const updates: Partial<User> = {};

    if (typeof name === "string") {
      const trimmedName = name.trim();

      if (trimmedName.length === 0) {
        return res.status(400).json({ error: "Parent name cannot be empty" });
      }

      updates.name = trimmedName;
    }

    if (typeof email === "string") {
      const trimmedEmail = email.trim().toLowerCase();

      if (trimmedEmail.length === 0) {
        return res.status(400).json({ error: "Email cannot be empty" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: "Invalid email address" });
      }

      updates.email = trimmedEmail;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided for update" });
    }

    const [parentProfile] = await db
      .select({ userId: parentProfiles.userId })
      .from(parentProfiles)
      .where(and(eq(parentProfiles.schoolId, schoolId), eq(parentProfiles.userId, id)))
      .limit(1);

    if (!parentProfile) {
      return res.status(404).json({ error: "Parent not found" });
    }

    const [updatedUser] = await db
      .update(user)
      .set(updates)
      .where(eq(user.id, id))
      .returning();

    return res.status(200).json({
      data: {
        ...parentProfile,
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error("PATCH /parent profile error: ", error);
    return res.status(500).json({ error: "There was an error editing the parent profile" });
  }
});

adminParentsRouter.post("/invite", async (req, res) => {
    try {
         const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const {studentId, parentEmail} = req.body;

        if (!studentId || typeof studentId !== "string") {
            return res.status(400).json({ error: "studentId required" });
        }

        if (!parentEmail || typeof parentEmail !== "string") {
            return res.status(400).json({ error: "parentEmail required" });
        }

        const normalizedEmail = parentEmail.trim().toLowerCase();

        const [student] = await db
            .select({userId: studentProfiles.userId})
            .from(studentProfiles)
            .where(and(eq(studentProfiles.schoolId, schoolId), eq(studentProfiles.userId, studentId)))
            .limit(1);

        if(!student){
            return res.status(404).json({error: "No student found"});
        }

        const token = generateInviteToken();
        const tokenHash = hashToken(token);

        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

        const newInvite: NewParentInvite = {
            id: randomUUID(),
            schoolId, 
            studentId, 
            parentEmail: normalizedEmail, 
            tokenHash, 
            expiresAt, 
        };

        await db.insert(parentInvites).values(newInvite);

        // TODO: 
        // SEND EMAIL TO LINK STUDENT AND PARENT
        // FOR NOW TOKEN IS RETURNED
        return res.status(201).json({
            data: {
                inviteId: newInvite.id, 
                token: token, 
                expiresAt: expiresAt, 
            }
        })
    } catch (error) {
        console.error("POST /parents/invite error: ", error);
        return res.status(500).json({error: "There was an error inviting the parent"});
    }
})