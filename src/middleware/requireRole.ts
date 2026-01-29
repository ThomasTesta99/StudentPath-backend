import { RequestHandler } from "express";
import { AppRole } from "../types/express";

export const requireRole = (roles: readonly AppRole[]) : RequestHandler => (req, res, next) => {
    const user = req.user;

    if(!user){
        res.status(401).json({message: "Unauthenticated"});
        return;
    }

    if(!roles.includes(user.role)){
        res.status(403).json({message: "Forbidden"});
        return;
    }
    next();
}