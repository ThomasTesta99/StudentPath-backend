import express from 'express'
import cors from 'cors'
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';
import { requireAuth } from './middleware/requireAuth';
import { requireRole } from './middleware/requireRole';
import { schoolsRouter } from './routes/admin/schools';
import { termsRouter } from './routes/admin/terms';
import { adminTeacherRouter} from './routes/admin/teachers';
import { coursesRouter } from './routes/admin/courses';
import { departmentsRouter } from './routes/admin/departments';
import { adminStudentsRouter } from './routes/admin/students';
import { enrollmentsRouter } from './routes/admin/enrollments';
import { parentInvitesRouter } from './routes/parents/redeemInvite';
import { adminParentsRouter } from './routes/admin/parents';
import { bellScheduleRouter } from './routes/admin/bell-schedule';
import { sectionsRouter } from './routes/admin/sections';
import { teacherSectionRouter } from './routes/teacher/sections';

const app = express();
const PORT = 8000;

if(!process.env.FRONTEND_URL){
    throw new Error("FRONTEND_URL not defined");
}

app.set("trust proxy", 1);
app.use(cors({
    origin: process.env.FRONTEND_URL, 
    methods: ['GET', 'POST', 'PUT', 'DELETE',  "PATCH"],
    credentials: true, 
}));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

// ADMIN ROUTES(TO DO: use string validation functions in utils)
app.use("/api/admin/schools", requireAuth, requireRole(['admin']), schoolsRouter);
app.use("/api/admin/bell-schedule", requireAuth, requireRole(['admin']), bellScheduleRouter);
app.use("/api/admin/terms", requireAuth, requireRole(["admin"]), termsRouter);
app.use("/api/admin/teachers", requireAuth, requireRole(["admin"]), adminTeacherRouter);
app.use("/api/admin/departments", requireAuth, requireRole(["admin"]), departmentsRouter);
app.use("/api/admin/courses", requireAuth, requireRole(["admin"]), coursesRouter);
app.use("/api/admin/sections", requireAuth, requireRole(["admin"]), sectionsRouter);
app.use("/api/admin/students", requireAuth, requireRole(["admin"]), adminStudentsRouter);
app.use("/api/admin/enrollments", requireAuth, requireRole(["admin"]), enrollmentsRouter);
app.use("/api/admin/parents", requireAuth, requireRole(["admin"]), adminParentsRouter);

// TEACHER ROUTES
app.use("/api/teacher/sections", requireAuth, requireRole(["teacher", "admin"]), teacherSectionRouter);

// PARENT ROUTES
app.use("/api/parents", requireAuth, requireRole(["parent"]), parentInvitesRouter);

app.get('/', async (req, res) => {
    res.send('Hello, welcome to the Classroom API');
});
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/admin/ping", requireAuth, requireRole(["admin"]), (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`)
});