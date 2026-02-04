import express from 'express'
import cors from 'cors'
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';
import { requireAuth } from './middleware/requireAuth';
import { requireRole } from './middleware/requireRole';
import { schoolsRouter } from './routes/admin/schools';

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

app.use("/api/admin/schools", requireAuth, requireRole(['admin']), schoolsRouter);

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