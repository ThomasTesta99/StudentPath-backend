import { eq } from "drizzle-orm";
import { db } from "../db";
import { adminProfiles, courses, departments, NewAdminProfile, NewCourse, NewDepartment, NewUser, session, user } from "../db/schema";
import { auth } from "../lib/auth";
import { randomUUID } from "crypto";

type Role = "student" | "teacher" | "admin" | "parent";

const seededUsers: Array<{
    email: string, 
    name: string, 
    password: string,
    role: "user" | "admin", 
    profileRole: Role,
}> = [ 
  { email: "teacher@test.com", name: "Teacher", password : "12345678", role: "user", profileRole: "teacher"},
  { email: "student@test.com", name: "Student" , password : "12345678", role: "user", profileRole: "student"},
  { email: "parent@test.com", name: "Parent" , password : "12345678", role: "user", profileRole: "parent"},
]

export const seededDepartments: Array<NewDepartment> = [
  {
    id: randomUUID(),
    name: "Computer Science",
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
  },
  {
    id: randomUUID(),
    name: "Mathematics",
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
  },
  {
    id: randomUUID(),
    name: "English",
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
  },
  {
    id: randomUUID(),
    name: "Science",
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
  },
] as const;


export const seededCourses: Array<NewCourse> = [
  {
    id: randomUUID(),
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
    termId: "87d8b5b4-4ff7-4e51-9569-829ede6810a2",
    teacherId: "zZypoW9lJ5JplqzMwSsdfHlHB6tYirvq",
    departmentId: "faac7acd-e6d7-4f27-9b52-0cbc346fb4b6",
    name: "Data Structures",
    gradeLevel: "11",
    code: "CSC 326",
    description: "Covers core data structures (lists, stacks, queues, trees, hash tables) and algorithmic thinking.",
  },
  {
    id: randomUUID(),
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
    termId: "87d8b5b4-4ff7-4e51-9569-829ede6810a2",
    teacherId: "zZypoW9lJ5JplqzMwSsdfHlHB6tYirvq",
    departmentId: "faac7acd-e6d7-4f27-9b52-0cbc346fb4b6",
    name: "Intro to Programming",
    gradeLevel: "10",
    code: "CSC 210",
    description: "Programming fundamentals: variables, control flow, functions, basic data structures, and debugging.",
  },
  {
    id: randomUUID(),
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
    termId: "87d8b5b4-4ff7-4e51-9569-829ede6810a2",
    teacherId: "zZypoW9lJ5JplqzMwSsdfHlHB6tYirvq",
    departmentId: "3880aa7e-892b-48a9-b713-39e1f7662116",
    name: "Algebra II",
    gradeLevel: "10",
    code: "MTH 221",
    description: "Functions, polynomials, rational expressions, exponential/logarithmic models, and systems.",
  },
  {
    id: randomUUID(),
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
    termId: "87d8b5b4-4ff7-4e51-9569-829ede6810a2",
    teacherId: "zZypoW9lJ5JplqzMwSsdfHlHB6tYirvq",
    departmentId: "3880aa7e-892b-48a9-b713-39e1f7662116",
    name: "Precalculus",
    gradeLevel: "11",
    code: "MTH 310",
    description: "Trigonometry, complex numbers, sequences/series, and preparation for calculus.",
  },
  {
    id: randomUUID(),
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
    termId: "87d8b5b4-4ff7-4e51-9569-829ede6810a2",
    teacherId: "zZypoW9lJ5JplqzMwSsdfHlHB6tYirvq",
    departmentId: "e96ec020-71f7-4bc4-ab76-521a6f031c95",
    name: "English Composition",
    gradeLevel: "9",
    code: "ENG 105",
    description: "Academic writing fundamentals: thesis, structure, evidence, and revision.",
  },
  {
    id: randomUUID(),
    schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
    termId: "87d8b5b4-4ff7-4e51-9569-829ede6810a2",
    teacherId: "zZypoW9lJ5JplqzMwSsdfHlHB6tYirvq",
    departmentId: "b47d1666-a053-491d-8bea-94b4ed860a86",
    name: "Biology",
    gradeLevel: "9",
    code: "SCI 140",
    description: "Cells, genetics, evolution, ecosystems, and scientific investigation skills.",
  },
] as const;



// async function createUser(email : string, name: string, password: string, role: Role){
//     try {
//         const result = await fetch("http://localhost:8000/api/admin/schools", {
//             method: "POST", 
//             headers: {"Content-Type": "application/json"}, 
//             credentials: "include",
//             body: JSON.stringify({
//             schoolName: "Tottenville High School", 
//             })
//         });

//       console.log(result.ok);
//       const text = await result.json();
//       console.log(text);
//     } catch (error) {
//         console.error("There was an error creating the user: ",error);
//     }
// }

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

// async function createAdmin({userId, schoolId}: NewAdminProfile){
//     try {
//         const userRole = await db
//             .select({role: user.role})
//             .from(user)
//             .where(eq(user.id, userId))
//             .limit(1);

//         if(userRole[0]?.role !== "admin"){
//             console.error("Must be admin");
//             return;
//         }
//         const [admin] = await db
//             .insert(adminProfiles)
//             .values({userId,schoolId})
//             .returning();

//         console.log("Admin created: ", admin);
//     } catch (error) {
//        console.error("Error creating admin: ", error); 
//     }
// }

// async function createAdmin(){
//     try {
//         const result = await auth.api.createUser({
//             body: {
//                 email: "ttesta99@yahoo.com", 
//                 password: "12345678", 
//                 name: "Thomas Testa",
//                 role: "admin", 
//                 data: {profileRole: "admin"},
//             }
//         })
//         console.log(result.user);
//     } catch (error) {
//         console.log(error);
//     }
// }

async function createAdminProfile() {
    try {
        const result = await db
            .insert(adminProfiles)
            .values({
                userId: "koipsHycBm3KN14GDvROHOihtUhY8hMW",
                schoolId: "bc3e9174-b0fa-4aed-b096-143c4f557d27",
            })

        console.log(result);
    } catch (error) {
        console.error(error);
    }
}

async function main() {
    // for(const user of seededUsers){
    //     await createUser(user.email, user.name, user.password, user.profileRole);
    // }

    // for(const department of seededDepartments){
    //     await createDepartment({newDepartment: department});
    // }

    for(const course of seededCourses){
        await createCourse({newCourse: course});
    }

    // await createAdmin({userId: "d0XeiKlTzRDluGhfjJZANEok6qAwgwQr", schoolId: "336a77ae-8764-45f4-a79d-d12533307c32"});
    // await createAdmin({userId: "EioVtcEfdtmd6X8bWMhMxzemIEDSjYKK", schoolId: "eb77bf11-0ea7-41fe-a328-67ca9bed3af4"});

    //await createAdmin();
    // await createAdminProfile();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("An error occured in main: ", error)
        process.exit(1);
    })