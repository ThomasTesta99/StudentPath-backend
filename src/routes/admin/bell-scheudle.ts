import express from "express"
import { getSchoolIdForAdmin, isValidTime, normalizeTime, timeLE, timeLT } from "../../lib/utils";
import { db } from "../../db";
import { bellSchedules, NewBellSchedule, NewPeriod, periods } from "../../db/schema";
import { and, asc, eq } from "drizzle-orm";
import { CreateBellScheduleBody, CreatePeriodBody } from "../../types";
import { randomUUID } from "crypto";

export const bellScheduleRouter = express.Router();

bellScheduleRouter.get("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const [schedule] = await db
            .select()
            .from(bellSchedules)
            .where(eq(bellSchedules.schoolId, schoolId))
            .limit(1);

        if(!schedule) return res.status(400).json({error: "There was an error getting the bell schedule"});

        return res.status(200).json({data: schedule});
    } catch (error) {
        console.error("GET /bell-schedule error:", error);
        return res.status(500).json({ error: "Failed to fetch bell schedule" });
    }
});

bellScheduleRouter.post("/", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const body = req.body as CreateBellScheduleBody;
        const {name, type = "regular", dayStartTime, dayEndTime} = body;

        if (typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ error: "name is required" });
        }
        if (typeof dayStartTime !== "string" || !isValidTime(dayStartTime)) {
            return res.status(400).json({ error: "dayStartTime must be HH:MM or HH:MM:SS" });
        }
        if (typeof dayEndTime !== "string" || !isValidTime(dayEndTime)) {
            return res.status(400).json({ error: "dayEndTime must be HH:MM or HH:MM:SS" });
        }
        if (!timeLT(dayStartTime, dayEndTime)) {
            return res.status(400).json({ error: "dayStartTime must be before dayEndTime" });
        }

        const [existing] = await db
            .select({ id: bellSchedules.id })
            .from(bellSchedules)
            .where(eq(bellSchedules.schoolId, schoolId))
            .limit(1);

        if (existing) {
            return res.status(409).json({ error: "Bell schedule already exists for this school" });
        }

        const newBellSchedule: NewBellSchedule = {
            id: randomUUID(), 
            name: name, 
            schoolId: schoolId, 
            dayStartTime: normalizeTime(dayStartTime), 
            dayEndTime: normalizeTime(dayEndTime), 
            type: type, 
        }

        const [created] = await db
            .insert(bellSchedules)
            .values(newBellSchedule)
            .returning();

        if(!created) return res.status(400).json({error: "Failed to create bell schedule"});

        return res.status(201).json({data: created});
    } catch (error) {
        console.error("POST /bell-schedule error:", error);
        return res.status(500).json({ error: "Failed to create bell schedule" });
    }
})

bellScheduleRouter.get("/periods", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });

        const [schedule] = await db
            .select({id: bellSchedules.id})
            .from(bellSchedules)
            .where(eq(bellSchedules.schoolId, schoolId))
            .limit(1);

        if(!schedule) return res.status(404).json({error: "Bell schedule not found"});

        const periodRows = await db
            .select()
            .from(periods)
            .where(eq(periods.bellScheduleId, schedule.id))
            .orderBy(asc(periods.number));

        return res.status(200).json({data: periodRows});
    } catch (error) {
        console.error("GET /bell-schedule/periods error:", error);
        return res.status(500).json({ error: "Failed to fetch periods" });
    }
})

bellScheduleRouter.post("/periods", async (req, res) => {
    try {
        const schoolId = await getSchoolIdForAdmin(req);
        if (!schoolId) return res.status(401).json({ error: "Not authorized" });
    
        const body = req.body as CreatePeriodBody;
        const {bellScheduleId, number, startTime, endTime} = body;

        if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
            return res.status(400).json({ error: "number must be a positive integer" });
        }
        if (typeof startTime !== "string" || !isValidTime(startTime)) {
            return res.status(400).json({ error: "startTime must be HH:MM or HH:MM:SS" });
        }
        if (typeof endTime !== "string" || !isValidTime(endTime)) {
            return res.status(400).json({ error: "endTime must be HH:MM or HH:MM:SS" });
        }
        if (!timeLT(startTime, endTime)) {
            return res.status(400).json({ error: "startTime must be before endTime" });
        }

        const [schedule] = await db
            .select()
            .from(bellSchedules)
            .where(eq(bellSchedules.schoolId, schoolId))
            .limit(1);

        if(!schedule) return res.status(404).json({error: "Bell schedule not found"});

        const start = normalizeTime(startTime);
        const end = normalizeTime(endTime);

        if (!timeLE(schedule.dayStartTime, start) || !timeLE(end, schedule.dayEndTime)) {
            return res.status(400).json({
                error: `Period must be within schedule hours (${schedule.dayStartTime} - ${schedule.dayEndTime})`,
            });
        }


        const existingPeriods = await db
            .select({ startTime: periods.startTime, endTime: periods.endTime })
            .from(periods)
            .where(eq(periods.bellScheduleId, schedule.id));

        const overlaps = existingPeriods.some((p) => {
            const aStart = normalizeTime(p.startTime);
            const aEnd = normalizeTime(p.endTime);
            return timeLT(start, aEnd) && timeLT(aStart, end);
        });

        if (overlaps) {
            return res.status(400).json({ error: "Period overlaps an existing period" });
        }

        const newPeriod: NewPeriod = {
            id: randomUUID(),
            schoolId,
            bellScheduleId: schedule.id,
            number,
            startTime: start,
            endTime: endTime,
        }

        const [created] = await db
            .insert(periods)
            .values(newPeriod)
            .returning();

        return res.status(201).json({ data: created });
    } catch (error) {
        console.error("POST /bell-schedule/me/periods error:", error);
        return res.status(500).json({ error: "Failed to create period" });
    }
})