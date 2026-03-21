import { eq, getTableColumns } from "drizzle-orm";
import { db } from "../db";
import { adminProfiles, assignmentTypeEnum, gradeLevelEnum, teacherProfiles, user } from "../db/schema";
import { auth } from "./auth";
import { Request } from "express";
import { AssignmentType, GradeLevel } from "../types";

export const getSchoolIdForAdmin = async (req: Request) => {
    try {
        let userId = "";

        if(!req.user?.id){
          const session = await auth.api.getSession({headers: req.headers});
          if(!session?.user?.id){
              console.error("No valid session");
              return;
          }
          userId = session.user.id;
        }else{
          userId = req.user.id;
        }

        const [schoolId] = await db
            .select({schoolId: adminProfiles.schoolId})
            .from(adminProfiles)
            .where(eq(adminProfiles.userId, String(userId)))
            .limit(1);

        if(!schoolId){
            console.error("Invalid user");
            return;
        }
        return schoolId.schoolId;
    } catch (error) {
        console.error("There was an error getting the school", error);
    }
}

export const getTeacherInformation = async (req: Request) => {
  try {
    let userId = "";

    if(!req.user?.id){
      const session = await auth.api.getSession({headers: req.headers});
      if(!session?.user?.id){
        console.error("No valid session");
        return;
      }
      userId = session.user.id;
    }else{
      userId = req.user.id;
    }

    const [teacher] = await db
      .select({
        ...getTableColumns(teacherProfiles),
        user: {
          ...getTableColumns(user)
        }
      })
      .from(teacherProfiles)
      .innerJoin(user, eq(teacherProfiles.userId, user.id))
      .where(eq(teacherProfiles.userId, userId))
      .limit(1);

    if(!teacher){
      console.error("Invalid user");
      return;
    }

    return teacher;
  } catch (error) {
    console.error("There was an error getting the teacher: ", error);
    throw error;
  }
}

const ALLOWED_GRADE_LEVELS = new Set<GradeLevel>(
  gradeLevelEnum.enumValues as GradeLevel[]
);

export function parseGradeLevel(raw: string): GradeLevel {
  const trimmed = raw.trim();

  if (!ALLOWED_GRADE_LEVELS.has(trimmed as GradeLevel)) {
    throw new Error(
      `Invalid gradeLevel. Allowed: ${gradeLevelEnum.enumValues.join(", ")}`
    );
  }

  return trimmed as GradeLevel;
}

export function normalizeGradeLevels(gradeLevels: GradeLevel[]): GradeLevel[] {
  const out: GradeLevel[] = [];
  const seen = new Set<GradeLevel>();
  for (const g of gradeLevels) {
    if (!seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}


export function isValidTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t);
}

export function normalizeTime(t: string) {
  return t.length === 5 ? `${t}:00` : t;
}

export function timeLT(a: string, b: string) {
  return normalizeTime(a) < normalizeTime(b);
}
export function timeLE(a: string, b: string) {
  return normalizeTime(a) <= normalizeTime(b);
}

export function requireTrimmedString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

export function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requirePositiveInt(value: unknown, fieldName: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return n;
}

export function optionalPositiveInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return n;
}

export function requireDateString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }

    const trimmed = value.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        throw new Error(`${fieldName} must be a valid date in YYYY-MM-DD format`);
    }

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
        throw new Error(`${fieldName} must be a valid date in YYYY-MM-DD format`);
    }

    return trimmed;
}

export function requireAssignmentType(value: unknown, fieldName: string): AssignmentType {
    if (typeof value !== "string") {
        throw new Error(`${fieldName} is required`);
    }

    const trimmed = value.trim();

    if (!(assignmentTypeEnum.enumValues as readonly string[]).includes(trimmed)) {
        throw new Error(`${fieldName} must be a valid assignment type`);
    }

    return trimmed as AssignmentType;
}

export function requireStringArray(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    const cleaned = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    if (cleaned.length === 0) {
        throw new Error(`${fieldName} must contain at least one value`);
    }

    return [...new Set(cleaned)];
}
