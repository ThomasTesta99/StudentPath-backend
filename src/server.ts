import express from 'express'
import cors from 'cors'
import { toNodeHandler } from "better-auth/node";
import { auth } from './lib/auth';

const app = express();
const PORT = 8000;

if(!process.env.FRONTEND_URL){
    throw new Error("FRONTEND_URL not defined");
}

app.use(cors({
    origin: process.env.FRONTEND_URL, 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, 
}));

app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hello, welcome to StudentPath backend");
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`)
});