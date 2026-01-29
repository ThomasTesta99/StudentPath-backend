import "express";

export type AppRole = "student" | "teacher" | "admin" | "parent";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string | null;
        role: AppRole;
      };
    }
  }
}

export {};
