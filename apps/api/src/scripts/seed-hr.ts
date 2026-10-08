import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: "Administration", code: "ADMIN" },
  { name: "Mathematics", code: "MATH" },
  { name: "Science", code: "SCI" },
  { name: "English", code: "ENG" },
  { name: "Social Studies", code: "SOC" },
  { name: "Languages", code: "LAN" },
  { name: "Computer Science", code: "CS" },
  { name: "Physical Education", code: "PE" },
  { name: "Arts", code: "ART" },
  { name: "Finance", code: "FIN" },
  { name: "Transport", code: "TRANS" },
  { name: "Library & Media", code: "LIB" },
];

const SAMPLE_EMPLOYEES: Array<{
  firstName: string;
  lastName: string;
  employeeId: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  salary: number;
  joiningYear: number;
}> = [
  { firstName: "Meera", lastName: "Krishnan", employeeId: "EMP001", phone: "+91 98111 22334", email: "meera.k@school.edu", department: "Mathematics", designation: "Senior Teacher", salary: 52000, joiningYear: 2021 },
  { firstName: "Vikram", lastName: "Rao", employeeId: "EMP002", phone: "+91 98222 33445", email: "vikram.rao@school.edu", department: "Science", designation: "Science Teacher", salary: 48000, joiningYear: 2022 },
  { firstName: "Sunita", lastName: "Patel", employeeId: "EMP003", phone: "+91 98333 44556", email: "sunita.p@school.edu", department: "English", designation: "English Teacher", salary: 45000, joiningYear: 2022 },
  { firstName: "Ramesh", lastName: "Kumar", employeeId: "EMP004", phone: "+91 98444 55667", email: "ramesh.k@school.edu", department: "Transport", designation: "Transport Coordinator", salary: 38000, joiningYear: 2020 },
  { firstName: "Anita", lastName: "Deshmukh", employeeId: "EMP005", phone: "+91 98555 66778", email: "anita.d@school.edu", department: "Finance", designation: "Accountant", salary: 42000, joiningYear: 2020 },
  { firstName: "Priya", lastName: "Nair", employeeId: "EMP006", phone: "+91 98666 77889", email: "priya.n@school.edu", department: "Administration", designation: "Office Administrator", salary: 35000, joiningYear: 2023 },
  { firstName: "Arjun", lastName: "Singh", employeeId: "EMP007", phone: "+91 98777 88990", email: "arjun.s@school.edu", department: "Computer Science", designation: "IT & CS Teacher", salary: 50000, joiningYear: 2021 },
  { firstName: "Lakshmi", lastName: "Menon", employeeId: "EMP008", phone: "+91 98888 99001", email: "lakshmi.m@school.edu", department: "Library & Media", designation: "Librarian", salary: 32000, joiningYear: 2022 },
];

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, schoolCode: true, name: true } });
  console.log(`Found ${schools.length} school(s)`);

  for (const school of schools) {
    for (const dept of DEPARTMENTS) {
      await prisma.department.upsert({
        where: { schoolId_code: { schoolId: school.id, code: dept.code } },
        update: {},
        create: { name: dept.name, code: dept.code, schoolId: school.id },
      });
    }

    const existingCount = await prisma.employee.count({ where: { schoolId: school.id } });
    if (existingCount > 0) {
      console.log(`[${school.schoolCode}] skipped employees (${existingCount} already exist)`);
      continue;
    }

    for (const emp of SAMPLE_EMPLOYEES) {
      await prisma.employee.create({
        data: {
          employeeId: emp.employeeId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          phone: emp.phone,
          email: emp.email,
          department: emp.department,
          designation: emp.designation,
          joiningDate: new Date(`${emp.joiningYear}-06-01T00:00:00.000Z`),
          salary: emp.salary,
          schoolId: school.id,
          status: "ACTIVE",
        },
      });
    }
    console.log(`[${school.schoolCode}] seeded ${SAMPLE_EMPLOYEES.length} employees + ${DEPARTMENTS.length} departments`);
  }
}

main()
  .then(() => {
    console.log("HR seed complete.");
    return prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("HR seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });