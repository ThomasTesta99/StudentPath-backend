import { eq } from "drizzle-orm";
import { db } from "../db";
import { adminProfiles, courses, departments, NewAdminProfile, NewCourse, NewDepartment, session, user } from "../db/schema";
import { auth } from "../lib/auth";
import { randomUUID } from "crypto";

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

// ===== Departments =====
export const seededDepartments: Array<NewDepartment> = [
  {
    id: randomUUID(),
    name: "Computer Science",
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
  },
  {
    id: randomUUID(),
    name: "Mathematics",
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
  },
  {
    id: randomUUID(),
    name: "English",
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
  },
  {
    id: randomUUID(),
    name: "Science",
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
  },
] as const;


// ===== Courses =====
export const seededCourses: Array<NewCourse> = [
  {
    id: randomUUID(),
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
    termId: "058bf082-f4bb-4b41-affc-a566c5eaec7e",
    teacherId: "KC2ssDoXyRF81TfixMgqbnaL4jPGjfaq",
    departmentId: "a15ea3df-59d5-48a6-a134-78df7feca6f2",
    name: "Data Structures",
    gradeLevel: "11",
    code: "CSC 326",
    description: "Covers core data structures (lists, stacks, queues, trees, hash tables) and algorithmic thinking.",
  },
  {
    id: randomUUID(),
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
    termId: "058bf082-f4bb-4b41-affc-a566c5eaec7e",
    teacherId: "KC2ssDoXyRF81TfixMgqbnaL4jPGjfaq",
    departmentId: "a15ea3df-59d5-48a6-a134-78df7feca6f2",
    name: "Intro to Programming",
    gradeLevel: "10",
    code: "CSC 210",
    description: "Programming fundamentals: variables, control flow, functions, basic data structures, and debugging.",
  },
  {
    id: randomUUID(),
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
    termId: "058bf082-f4bb-4b41-affc-a566c5eaec7e",
    teacherId: "KC2ssDoXyRF81TfixMgqbnaL4jPGjfaq",
    departmentId: "31822d3d-7560-46e5-95c5-1293a66e709b",
    name: "Algebra II",
    gradeLevel: "10",
    code: "MTH 221",
    description: "Functions, polynomials, rational expressions, exponential/logarithmic models, and systems.",
  },
  {
    id: randomUUID(),
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
    termId: "058bf082-f4bb-4b41-affc-a566c5eaec7e",
    teacherId: "KC2ssDoXyRF81TfixMgqbnaL4jPGjfaq",
    departmentId: "31822d3d-7560-46e5-95c5-1293a66e709b",
    name: "Precalculus",
    gradeLevel: "11",
    code: "MTH 310",
    description: "Trigonometry, complex numbers, sequences/series, and preparation for calculus.",
  },
  {
    id: randomUUID(),
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
    termId: "058bf082-f4bb-4b41-affc-a566c5eaec7e",
    teacherId: "KC2ssDoXyRF81TfixMgqbnaL4jPGjfaq",
    departmentId: "4c773759-20e1-4e3b-9981-4979a24ab409",
    name: "English Composition",
    gradeLevel: "9",
    code: "ENG 105",
    description: "Academic writing fundamentals: thesis, structure, evidence, and revision.",
  },
  {
    id: randomUUID(),
    schoolId: "336a77ae-8764-45f4-a79d-d12533307c32",
    termId: "058bf082-f4bb-4b41-affc-a566c5eaec7e",
    teacherId: "KC2ssDoXyRF81TfixMgqbnaL4jPGjfaq",
    departmentId: "eaccefb5-f067-4d08-8854-fd980c256975",
    name: "Biology",
    gradeLevel: "9",
    code: "SCI 140",
    description: "Cells, genetics, evolution, ecosystems, and scientific investigation skills.",
  },
] as const;



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

async function createDepartment({newDepartment} : {newDepartment: NewDepartment}){
    try {
        const [department] = await db
            .insert(departments)
            .values(newDepartment)
            .returning();

        console.log("Deparment has been created: ", department);
    } catch (error) {
        console.error("There was an error creating department: ", error);
    }
}

async function createCourse({newCourse}: {newCourse: NewCourse}){
    try {
        const [course] = await db
            .insert(courses)
            .values(newCourse)
            .returning();

        console.log("Course has been created: ", course);
    } catch (error) {
        console.error("There was an error creating the course: ", error);
    }
}

async function createAdmin({userId, schoolId}: NewAdminProfile){
    try {
        const userRole = await db
            .select({role: user.role})
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);

        if(userRole[0]?.role !== "admin"){
            console.error("Must be admin");
            return;
        }
        const [admin] = await db
            .insert(adminProfiles)
            .values({userId,schoolId})
            .returning();

        console.log("Admin created: ", admin);
    } catch (error) {
       console.error("Error creating admin: ", error); 
    }
}

async function main() {
    // for(const user of seededUsers){
    //     await createUser(user.email, user.name, user.password, user.role);
    // }

    // for(const department of seededDepartments){
    //     await createDepartment({newDepartment: department});
    // }

    // for(const course of seededCourses){
    //     await createCourse({newCourse: course});
    // }

    await createAdmin({userId: "d0XeiKlTzRDluGhfjJZANEok6qAwgwQr", schoolId: "336a77ae-8764-45f4-a79d-d12533307c32"});
    await createAdmin({userId: "EioVtcEfdtmd6X8bWMhMxzemIEDSjYKK", schoolId: "eb77bf11-0ea7-41fe-a328-67ca9bed3af4"});
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("An error occured in main: ", error)
        process.exit(1);
    })