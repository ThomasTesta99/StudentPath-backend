import { assignmentTypeEnum, gradeLevelEnum } from "../db/schema";

export type GradeLevel = (typeof gradeLevelEnum.enumValues)[number];

export type PatchSchoolBody = {
  schoolName?: string;
  gradeLevels?: GradeLevel[];
};

export type CreateBellScheduleBody = {
  name: string;
  type?: "regular" | "early_dismissal" | "late_start" | "testing" | "assembly" | "custom";
  dayStartTime: string; 
  dayEndTime: string; 
};

export type CreatePeriodBody = {
  bellScheduleId?: string; 
  number: number;          
  startTime: string;      
  endTime: string;         
};

export type PatchSectionBody = {
  termId?: string;
  courseId?: string;
  periodId?: string;
  teacherId?: string;
  capacity?: number | string;
  roomNumber?: string;
  sectionLabel?: string;
};

export const ALLOWED_GRADE_LEVELS = [
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;


export type AssignmentType = typeof assignmentTypeEnum.enumValues[number];
