import express from "express";
import { auth } from "../../lib/auth";
import { hashToken } from "../../lib/invite";
import { db } from "../../db";
import { NewParentStudentLink, parentInvites, parentProfiles, parentStudentLinks, studentProfiles } from "../../db/schema";
import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";

export const parentInvitesRouter = express.Router();

parentInvitesRouter.post("/redeem-invite", async (req, res) => {
    try {
        const session = await auth.api.getSession({headers: req.headers});
        const user = session?.user
        if(!user) return res.status(401).json({error: "Not authenticated"});
        if(user.profileRole !== "parent"){
            return res.status(403).json({error: "Must be a parent"});
        }

        const {token} = req.body;
        if(!token || typeof token !== "string"){
            return res.status(400).json({error: "Token required"});
        }

        const tokenHash = hashToken(token.trim());
        const now = new Date();

        const [invite] = await db
            .select()
            .from(parentInvites)
            .where(and(
                eq(parentInvites.tokenHash, tokenHash),
                isNull(parentInvites.usedAt),
                gt(parentInvites.expiresAt, now),
            ))
            .limit(1);

        if(!invite){
            return res.status(400).json({error: "Invalid or expired invite"});
        }

        if(user.email !== invite.parentEmail){
            return res.status(403).json({error: "Invite issued to different email"});
        }

        const [existingProfile] = await db
            .select({userId: parentProfiles.userId})
            .from(parentProfiles)
            .where(eq(parentProfiles.userId, user.id))
            .limit(1);

        if(!existingProfile){
            return res.status(400).json({error: "No parent profile"});
        }

        const [student] = await db
            .select({userId: studentProfiles.userId})
            .from(studentProfiles)
            .where(and(eq(studentProfiles.userId, invite.studentId), eq(studentProfiles.schoolId, invite.schoolId)))
            .limit(1);

        if(!student){
            return res.status(400).json({error: "No student"});
        }

        const [existingLink] = await db
            .select({parentId: parentStudentLinks.parentId})
            .from(parentStudentLinks)
            .where(and(eq(parentStudentLinks.parentId, user.id), eq(parentStudentLinks.studentId, invite.studentId)))
            .limit(1);

        if(!existingLink){
            const newLink: NewParentStudentLink = {
                parentId: user.id,
                studentId: invite.studentId, 
            }
            await db.insert(parentStudentLinks).values(newLink);
        }

        await db
            .update(parentInvites)
            .set({usedAt: now})
            .where(eq(parentInvites.id, invite.id))

        return res.status(200).json({ok: true, studentId: invite.studentId});
    } catch (error) {
        console.error("POST /parents/redeem-invite error: ", error);
        return res.status(500).json({error: "Failed to redeem invite"});
    }
})