import { gradeLevelEnum } from "../db/schema";

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