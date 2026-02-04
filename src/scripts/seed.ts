import { eq } from "drizzle-orm";
import { db } from "../db";
import { session, user } from "../db/schema";
import { auth } from "../lib/auth";

type Role = "student" | "teacher" | "admin" | "parent";

const seededUsers: Array<{
    email: string, 
    name: string, 
    password: string,
    role: Role
}> = [ 
    { email: "admin@test.com", name: "Admin", password : "12345678", role: "admin"},
  { email: "teacher@test.com", name: "Teacher", password : "12345678", role: "teacher"},
  { email: "student@test.com", name: "Student" , password : "12345678", role: "student"},
  { email: "parent@test.com", name: "Parent" , password : "12345678", role: "parent"},
]


async function createUser(email : string, name: string, password: string, role: Role){
    try {
        const result = await auth.api.signUpEmail({
            body: {
                name, 
                email, 
                password
            }
        })

        if(!result.user){
            throw new Error("There was an error thrown creating a new user.");
        }

        const userId = result.user.id;

        // update user role

        await db
            .update(user)
            .set({role: role})
            .where(eq(user.id, userId));

        console.log('User:', result.user);
        await db.delete(session).where(eq(session.userId, userId));
    } catch (error) {
        console.error("There was an error creating the user: ",error);
    }
}

async function main() {
    for(const user of seededUsers){
        await createUser(user.email, user.name, user.password, user.role);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("An error occured in main: ", error)
        process.exit(1);
    })