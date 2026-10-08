import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS } from "../src/constants/permissions";

const prisma = new PrismaClient();

const ADMIN_PASSWORD = "Admin@2024";
const DEMO_PASSWORD = "School@2024";

async function seedRoles() {
  const roleData = [
    {
      name: "SUPER_ADMIN",
      description: "Platform administrator with access to all schools",
      isSystem: true,
      permissions: ["*"],
    },
    { name: "SCHOOL_ADMIN", description: "School administrator", isSystem: true },
    { name: "BRANCH_ADMIN", description: "Branch administrator", isSystem: true },
    { name: "PRINCIPAL", description: "Academic head", isSystem: true },
    { name: "VICE_PRINCIPAL", description: "Deputy academic head", isSystem: true },
    { name: "TEACHER", description: "Class and subject teacher", isSystem: true },
    { name: "ACCOUNTANT", description: "Finance manager", isSystem: true },
    { name: "HR_MANAGER", description: "HR and payroll manager", isSystem: true },
    { name: "LIBRARIAN", description: "Library manager", isSystem: true },
    { name: "TRANSPORT_MANAGER", description: "Transport manager", isSystem: true },
    { name: "RECEPTIONIST", description: "Front desk", isSystem: true },
    { name: "STAFF", description: "General staff", isSystem: true },
    { name: "STUDENT", description: "Student account", isSystem: true },
    { name: "PARENT", description: "Parent account", isSystem: true },
  ];

  const roles: Record<string, string> = {};

  for (const role of roleData) {
    const { permissions: _permissions, ...createData } = role;
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: createData,
    });
    roles[role.name] = created.id;
    console.log(`Created role: ${role.name}`);
  }

  return roles;
}

async function seedPermissions(roles: Record<string, string>) {
  const modules = [
    "student",
    "parent",
    "teacher",
    "attendance",
    "fees",
    "exam",
    "academics",
    "timetable",
    "homework",
    "library",
    "transport",
    "hr",
    "payroll",
    "inventory",
    "communication",
    "announcement",
    "message",
    "school",
    "user",
    "role",
    "report",
    "settings",
    "admin",
    "audit",
    "subscription",
  ];

  const actions = ["view", "create", "edit", "delete"];

  // Create all permissions
  for (const module of modules) {
    for (const action of actions) {
      const name = `${module}.${action}`;
      await prisma.permission.upsert({
        where: { name },
        update: {},
        create: { name, module, action, description: `${action} ${module}` },
      });
    }
  }

  // Ensure every permission used by the app exists (single source of truth)
  for (const name of Object.values(PERMISSIONS)) {
    const [module, action] = name.split(".");
    await prisma.permission.upsert({
      where: { name },
      update: { module, action },
      create: { name, module, action, description: `${action} ${module}` },
    });
  }

  console.log("Permissions created");

  // Assign all permissions to SUPER_ADMIN
  const allPermissions = await prisma.permission.findMany();
  const superAdminRoleId = roles.SUPER_ADMIN;
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRoleId,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: superAdminRoleId, permissionId: perm.id },
    });
  }

  // Assign common permissions to SCHOOL_ADMIN
  const schoolAdminPermissions = [
    "student.view", "student.create", "student.edit",
    "parent.view", "parent.create", "parent.edit",
    "teacher.view", "teacher.create", "teacher.edit",
    "attendance.view", "attendance.create",
    "fees.view", "fees.manage", "fees.collect", "fees.report",
    "exam.view", "exam.create", "exam.publish", "exam.results",
    "academics.view", "academics.create",
    "timetable.view", "timetable.edit",
    "homework.view", "homework.create",
    "library.view", "library.issue", "library.return",
    "transport.view", "transport.edit",
    "hr.view", "hr.create",
    "inventory.view", "inventory.create",
    "communication.view", "message.send",
    "report.view", "report.export",
    "school.view", "school.edit",
    "role.manage",
    "settings.manage",
    "user.view", "user.create", "user.edit",
  ];

  await assignRolePermissions(roles.SCHOOL_ADMIN, schoolAdminPermissions);

  // Teacher
  const teacherPermissions = [
    "student.view",
    "attendance.view", "attendance.create",
    "exam.view",
    "academics.view",
    "timetable.view",
    "homework.view", "homework.create",
    "communication.view", "message.send",
  ];
  await assignRolePermissions(roles.TEACHER, teacherPermissions);

  // Accountant
  const accountantPermissions = [
    "fees.view", "fees.manage", "fees.collect", "fees.refund", "fees.report",
    "report.view", "report.export",
  ];
  await assignRolePermissions(roles.ACCOUNTANT, accountantPermissions);

  // HR Manager
  const hrPermissions = [
    "hr.view", "hr.create", "hr.edit",
    "payroll.view", "payroll.manage",
    "attendance.view",
    "report.view",
  ];
  await assignRolePermissions(roles.HR_MANAGER, hrPermissions);

  // Librarian
  const librarianPermissions = [
    "library.view", "library.issue", "library.return",
    "student.view",
  ];
  await assignRolePermissions(roles.LIBRARIAN, librarianPermissions);

  // Transport Manager
  const transportPermissions = [
    "transport.view", "transport.edit",
    "student.view",
  ];
  await assignRolePermissions(roles.TRANSPORT_MANAGER, transportPermissions);

  // Parent
  const parentPermissions = [
    "student.view",
    "attendance.view",
    "exam.view",
    "fees.view",
    "homework.view",
    "timetable.view",
    "communication.view", "message.send",
    "transport.view",
  ];
  await assignRolePermissions(roles.PARENT, parentPermissions);

  // Student
  const studentPermissions = [
    "attendance.view",
    "exam.view", "exam.results",
    "fees.view",
    "homework.view",
    "timetable.view",
    "communication.view",
  ];
  await assignRolePermissions(roles.STUDENT, studentPermissions);

  console.log("Role permissions assigned");
}

async function assignRolePermissions(roleId: string, permissions: string[]) {
  for (const permName of permissions) {
    const perm = await prisma.permission.findUnique({ where: { name: permName } });
    if (!perm) continue;
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId: perm.id },
      },
      update: {},
      create: { roleId, permissionId: perm.id },
    });
  }
}

async function seedSubscriptionPlans() {
  const plans = [
    {
      name: "FREE",
      description: "Free tier for small schools",
      price: 0,
      maxSchools: 1,
      maxStudents: 100,
      maxStaff: 20,
      maxStorage: 1024,
      features: ["Students", "Attendance", "Fees"],
    },
    {
      name: "STARTER",
      description: "For growing schools",
      price: 2999,
      maxSchools: 1,
      maxStudents: 500,
      maxStaff: 50,
      maxStorage: 5120,
      features: ["Students", "Attendance", "Fees", "Exams", "Library"],
    },
    {
      name: "PROFESSIONAL",
      description: "Complete ERP suite",
      price: 7999,
      maxSchools: 3,
      maxStudents: 2000,
      maxStaff: 200,
      maxStorage: 20480,
      features: ["Students", "Attendance", "Fees", "Exams", "Library", "Transport", "HR", "Inventory"],
    },
    {
      name: "ENTERPRISE",
      description: "Multi-school enterprise solution",
      price: 19999,
      maxSchools: 20,
      maxStudents: 10000,
      maxStaff: 1000,
      maxStorage: 102400,
      features: ["Everything", "AI Assistant", "Custom Branding"],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
  }

  console.log("Subscription plans created");
}

async function seedSchoolsAndData() {
  const schoolData = [
    {
      name: "Greenfield International School",
      schoolCode: "GIS001",
      email: "info@greenfield.edu",
      phone: "+91 98765 43210",
      address: "12 Lake View Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      principalName: "Dr. Rajesh Kumar",
    },
    {
      name: "Riverside Public School",
      schoolCode: "RPS001",
      email: "contact@riverside.edu",
      phone: "+91 97654 32109",
      address: "45 Riverbank Avenue",
      city: "Mumbai",
      state: "Maharashtra",
      country: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      principalName: "Ms. Priya Sharma",
    },
    {
      name: "Sunrise Academy",
      schoolCode: "SRA001",
      email: "hello@sunriseacademy.edu",
      phone: "+91 96543 21098",
      address: "77 Sunrise Boulevard",
      city: "Pune",
      state: "Maharashtra",
      country: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      principalName: "Mr. Arun Verma",
    },
    {
      name: "Hillcrest International School",
      schoolCode: "HIS001",
      email: "office@hillcrest.edu",
      phone: "+91 95432 10987",
      address: "301 Hillcrest Lane",
      city: "Hyderabad",
      state: "Telangana",
      country: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      principalName: "Dr. Anita Desai",
    },
    {
      name: "New Katak Public School",
      schoolCode: "NKP001",
      email: "info@newkatak.edu",
      phone: "+91 94321 09000",
      address: "8 Katak Main Road",
      city: "Katak",
      state: "Odisha",
      country: "IN",
      timezone: "Asia/Kolkata",
      currency: "INR",
      principalName: "Mr. Suresh Patra",
    },
  ];

  const roles = await seedRoles();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Super Admin
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: "admin@schoolsphere.test", roleId: roles.SUPER_ADMIN },
  });
  const superAdmin =
    existingSuperAdmin ||
    (await prisma.user.create({
      data: {
        email: "admin@schoolsphere.test",
        passwordHash,
        firstName: "Rahul",
        lastName: "Mehta",
        roleId: roles.SUPER_ADMIN,
      },
    }));
  console.log("Super Admin created:", superAdmin.email);

  let schoolCount = 0;

  for (const schoolInfo of schoolData) {
    // Create/upsert school
    const existingSchool = await prisma.school.findUnique({
      where: { schoolCode: schoolInfo.schoolCode },
    });

    const school = existingSchool || (await prisma.school.create({ data: schoolInfo }));
    schoolCount++;

    // Subscribe to plan
    if (!existingSchool) {
      const starterPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: "STARTER" },
      });
      if (starterPlan) {
        await prisma.subscription.create({
          data: {
            schoolId: school.id,
            planId: starterPlan.id,
            status: "ACTIVE",
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    // Branch
    const branch = await prisma.branch.upsert({
      where: { schoolId_code: { schoolId: school.id, code: "MAIN" } },
      update: {},
      create: {
        name: "Main Campus",
        code: "MAIN",
        schoolId: school.id,
        isMain: true,
        email: school.email,
        phone: school.phone,
        city: school.city,
        state: school.state,
      },
    });

    // Academic Years (April → March)
    const priorYear = await prisma.academicYear.upsert({
      where: { schoolId_name: { schoolId: school.id, name: "AY 2025-2026" } },
      update: { isCurrent: false },
      create: {
        name: "AY 2025-2026",
        startDate: new Date("2025-04-01"),
        endDate: new Date("2026-03-31"),
        isCurrent: false,
        schoolId: school.id,
      },
    });

    const academicYear = await prisma.academicYear.upsert({
      where: { schoolId_name: { schoolId: school.id, name: "AY 2026-2027" } },
      update: { isCurrent: true },
      create: {
        name: "AY 2026-2027",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
        schoolId: school.id,
      },
    });

    // School Admin user
    const adminEmail = `admin@${school.schoolCode.toLowerCase()}.test`;
    await prisma.user.upsert({
      where: { email_schoolId: { email: adminEmail, schoolId: school.id } },
      update: {},
      create: {
        email: adminEmail,
        passwordHash: demoHash,
        firstName: `Admin`,
        lastName: school.name.split(" ")[0],
        roleId: roles.SCHOOL_ADMIN,
        schoolId: school.id,
        branchId: branch.id,
      },
    });

    // Departments
    const departmentNames = ["Science", "Mathematics", "English", "Social Studies", "Computer Science"];
    const departments: Record<string, string> = {};
    for (const deptName of departmentNames) {
      const dept = await prisma.department.upsert({
        where: { schoolId_code: { schoolId: school.id, code: deptName.toUpperCase().replace(/ /g, "_") } },
        update: {},
        create: {
          name: deptName,
          code: deptName.toUpperCase().replace(/ /g, "_"),
          schoolId: school.id,
        },
      });
      departments[deptName] = dept.id;
    }

    // Classes — LKG through Class 12 (Indian K-12 system)
    const classNames = [
      "LKG", "UKG",
      "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
      "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
      "Class 11", "Class 12",
    ];
    const classCodeMap: Record<string, string> = {
      LKG: "LKG", UKG: "UKG",
      "Class 1": "C1", "Class 2": "C2", "Class 3": "C3", "Class 4": "C4",
      "Class 5": "C5", "Class 6": "C6", "Class 7": "C7", "Class 8": "C8",
      "Class 9": "C9", "Class 10": "C10", "Class 11": "C11", "Class 12": "C12",
    };
    const classes: Record<string, string> = {};
    for (let idx = 0; idx < classNames.length; idx++) {
      const className = classNames[idx];
      const code = classCodeMap[className];
      const cls = await prisma.schoolClass.upsert({
        where: { schoolId_academicYearId_code: { schoolId: school.id, academicYearId: academicYear.id, code } },
        update: {},
        create: {
          name: className,
          code,
          schoolId: school.id,
          academicYearId: academicYear.id,
          departmentId: departments["Mathematics"],
        },
      });
      classes[className] = cls.id;

      // Sections
      for (const sectionName of ["A", "B", "C"]) {
        await prisma.section.upsert({
          where: { classId_name: { classId: cls.id, name: sectionName } },
          update: {},
          create: {
            name: sectionName,
            classId: cls.id,
          },
        });
      }
    }

    // Teachers
    const teachers = [
      { firstName: "Meera", lastName: "Krishnan", subject: "Mathematics", dept: "Mathematics" },
      { firstName: "Vikram", lastName: "Rao", subject: "Physics", dept: "Science" },
      { firstName: "Sunita", lastName: "Patel", subject: "English", dept: "English" },
      { firstName: "Arjun", lastName: "Nair", subject: "Computer Science", dept: "Computer Science" },
      { firstName: "Lakshmi", lastName: "Menon", subject: "History", dept: "Social Studies" },
    ];

    const teacherIds: string[] = [];
    for (let t = 0; t < teachers.length; t++) {
      const teacherData = teachers[t];
      const teacherEmail = `teacher${t + 1}@${school.schoolCode.toLowerCase()}.test`;

      const user = await prisma.user.upsert({
        where: { email_schoolId: { email: teacherEmail, schoolId: school.id } },
        update: {},
        create: {
          email: teacherEmail,
          passwordHash: demoHash,
          firstName: teacherData.firstName,
          lastName: teacherData.lastName,
          roleId: roles.TEACHER,
          schoolId: school.id,
          branchId: branch.id,
        },
      });

      const existingTeacher = await prisma.teacher.findFirst({
        where: { schoolId: school.id, employeeId: `TCH${String(t + 1).padStart(3, "0")}` },
      });

      const teacher = existingTeacher || (await prisma.teacher.create({
        data: {
          userId: user.id,
          employeeId: `TCH${String(t + 1).padStart(3, "0")}`,
          firstName: teacherData.firstName,
          lastName: teacherData.lastName,
          email: teacherEmail,
          specialization: teacherData.subject,
          joiningDate: new Date("2023-06-01"),
          schoolId: school.id,
          branchId: branch.id,
        },
      }));
      teacherIds.push(teacher.id);

      // Subject per school
      await prisma.subject.upsert({
        where: { schoolId_code: { schoolId: school.id, code: teacherData.subject.toUpperCase().replace(/ /g, "_") } },
        update: {},
        create: {
          name: teacherData.subject,
          code: teacherData.subject.toUpperCase().replace(/ /g, "_"),
          schoolId: school.id,
        },
      });
    }

    // Students
    const firstNames = ["Aarav", "Diya", "Ishaan", "Ananya", "Rohan", "Meera", "Kabir", "Zara", "Nikhil", "Sana"];
    const lastNames = ["Gupta", "Singh", "Kumar", "Iyer", "Sharma", "Patel", "Reddy", "Menon", "Das", "Joshi"];

    const students: string[] = [];

    for (let i = 0; i < 20; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      const className = classNames[i % classNames.length];
      const admissionNumber = `ADM${new Date().getFullYear()}${String(i + 1).padStart(4, "0")}`;

      const existingStudent = await prisma.student.findUnique({
        where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber } },
      });

      if (!existingStudent) {
        const section = await prisma.section.findFirst({
          where: { classId: classes[className] },
        });

        const student = await prisma.student.create({
          data: {
            admissionNumber,
            studentId: `STU${String(i + 1).padStart(5, "0")}`,
            firstName,
            lastName,
            dateOfBirth: new Date(`2015-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`),
            gender: i % 2 === 0 ? "MALE" : "FEMALE",
            bloodGroup: ["A+", "B+", "O+", "AB+"][i % 4],
            admissionDate: new Date(`2024-06-0${(i % 9) + 1}`),
            classId: classes[className],
            sectionId: section?.id,
            rollNumber: i + 1,
            schoolId: school.id,
            branchId: branch.id,
          },
        });

        // Parent user
        const parentEmail = `parent${i + 1}@${school.schoolCode.toLowerCase()}.test`;
        await prisma.user.upsert({
          where: { email_schoolId: { email: parentEmail, schoolId: school.id } },
          update: {},
          create: {
            email: parentEmail,
            passwordHash: demoHash,
            firstName: `Parent`,
            lastName: lastName,
            roleId: roles.PARENT,
            schoolId: school.id,
            branchId: branch.id,
          },
        });

        const parent = await prisma.parent.create({
          data: {
            firstName: `Parent`,
            lastName: lastName,
            phone: `+91 9${String(8765432100 + i).slice(1)}`,
            email: parentEmail,
            occupation: "Professional",
            schoolId: school.id,
          },
        });

        await prisma.studentParent.create({
          data: {
            studentId: student.id,
            parentId: parent.id,
            relation: "FATHER",
          },
        });

        students.push(student.id);

        // Fee Category and Structure
        if (i < 5) {
          const feeCategory = await prisma.feeCategory.upsert({
            where: { schoolId_name: { schoolId: school.id, name: "Tuition" } },
            update: {},
            create: {
              name: "Tuition",
              description: "Monthly tuition fee",
              schoolId: school.id,
            },
          });

          const feeStructure = await prisma.feeStructure.findFirst({
            where: { schoolId: school.id, name: "Annual Tuition" },
          });

          if (!feeStructure) {
            await prisma.feeStructure.create({
              data: {
                name: "Annual Tuition",
                amount: 24000,
                feeCategoryId: feeCategory.id,
                schoolId: school.id,
                classId: classes[className],
                academicYearId: academicYear.id,
                dueDate: new Date("2025-05-31"),
              },
            });
          }

          const invoiceNumber = `INV-${school.schoolCode}-${String(i + 1).padStart(4, "0")}`;
          const existingInvoice = await prisma.invoice.findUnique({
            where: { schoolId_invoiceNumber: { schoolId: school.id, invoiceNumber } },
          });

          if (!existingInvoice) {
            const invoice = await prisma.invoice.create({
              data: {
                invoiceNumber,
                studentId: student.id,
                schoolId: school.id,
                totalAmount: 24000,
                paidAmount: i % 3 === 0 ? 24000 : 0,
                status: i % 3 === 0 ? "PAID" : "PENDING",
                dueDate: new Date("2025-05-31"),
                items: {
                  create: {
                    feeCategoryId: feeCategory.id,
                    description: "Annual tuition fee",
                    amount: 24000,
                  },
                },
              },
            });

            if (i % 3 === 0) {
              await prisma.payment.create({
                data: {
                  invoiceId: invoice.id,
                  amount: 24000,
                  method: "RAZORPAY",
                  status: "COMPLETED",
                  schoolId: school.id,
                },
              });
            }
          }
        }

        // Attendance
        const today = new Date();
        for (let d = 0; d < 30; d++) {
          const date = new Date(today);
          date.setDate(today.getDate() - d);
          const dow = date.getDay();
          if (dow === 0) continue;

          await prisma.attendance.upsert({
            where: {
              studentId_date: { studentId: student.id, date },
            },
            update: {},
            create: {
              studentId: student.id,
              date,
              status: d % 10 === 0 ? "ABSENT" : d % 5 === 0 ? "LATE" : "PRESENT",
              schoolId: school.id,
            },
          });
        }
      }
    }

    // Monthly Fee Management (AY 2026-2027)
    await seedFeeManagement(school, academicYear, classes);

    // Exams (for current academic year)
    const schoolSubjects = await prisma.subject.findMany({
      where: { schoolId: school.id },
      select: { id: true, name: true },
    });

    const examDefinitions = [
      {
        name: "Unit Test 1",
        type: "Unit",
        status: "PUBLISHED" as const,
        startOffset: -90,
        endOffset: -85,
        subjectIndices: [0, 2],
      },
      {
        name: "Mid-Term Examination",
        type: "Term",
        status: "PUBLISHED" as const,
        startOffset: -60,
        endOffset: -45,
        subjectIndices: [0, 1, 2, 3, 4],
      },
      {
        name: "Unit Test 2",
        type: "Unit",
        status: "COMPLETED" as const,
        startOffset: -15,
        endOffset: -10,
        subjectIndices: [0, 1, 2],
      },
      {
        name: "Final Term Examination",
        type: "Term",
        status: "SCHEDULED" as const,
        startOffset: 5,
        endOffset: 20,
        subjectIndices: [0, 1, 2, 3, 4],
      },
      {
        name: "Assignment Test",
        type: "Assignment",
        status: "SCHEDULED" as const,
        startOffset: 30,
        endOffset: 32,
        subjectIndices: [0, 2],
      },
    ];

    const allStudentIds = await prisma.student.findMany({
      where: { schoolId: school.id },
      select: { id: true },
    });
    const studentIds = allStudentIds.map((s) => s.id);

    for (const examDef of examDefinitions) {
      const existingExam = await prisma.exam.findFirst({
        where: { schoolId: school.id, name: examDef.name },
      });
      if (existingExam) continue;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() + examDef.startOffset);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + examDef.endOffset);

      const exam = await prisma.exam.create({
        data: {
          name: examDef.name,
          type: examDef.type,
          schoolId: school.id,
          academicYearId: academicYear.id,
          startDate,
          endDate,
          status: examDef.status,
        },
      });

      for (let si = 0; si < examDef.subjectIndices.length; si++) {
        const subjectIdx = examDef.subjectIndices[si];
        const subject = schoolSubjects[subjectIdx];
        if (!subject) continue;

        const subDate = new Date(startDate);
        subDate.setDate(subDate.getDate() + si);

        const examSubject = await prisma.examSubject.create({
          data: {
            examId: exam.id,
            subjectId: subject.id,
            maxMarks: 100,
            passMarks: 33,
            date: subDate,
            startTime: "09:00",
            endTime: "12:00",
          },
        });

        // Create marks for published/completed exams
        if (examDef.status === "PUBLISHED" || examDef.status === "COMPLETED") {
          for (const studId of studentIds) {
            const obtained = Math.floor(Math.random() * 55) + 45;
            await prisma.mark.create({
              data: {
                examSubjectId: examSubject.id,
                studentId: studId,
                marksObtained: obtained,
                remarks: obtained < 33 ? "Needs improvement" : null,
              },
            });
          }
        }
      }

      console.log(`  Seeded exam: ${examDef.name} (${examDef.status})`);
    }

    // Books
    const books = [
      { title: "Mathematics for Class 5", isbn: "978-0131103627", author: "Dr. A. Sharma", category: "Textbook" },
      { title: "English Literature Anthology", isbn: "978-0201633610", author: "Prof. J. Williams", category: "Literature" },
      { title: "Introduction to Science", isbn: "978-0262033848", author: "Dr. S. Bakshi", category: "Textbook" },
      { title: "World History", isbn: "978-0321751041", author: "Dr. R. Menon", category: "History" },
      { title: "Computer Programming Basics", isbn: "978-0134685991", author: "Prof. N. Rao", category: "Computer" },
    ];

    for (const bookData of books) {
      const existingBook = await prisma.book.findFirst({
        where: { schoolId: school.id, isbn: bookData.isbn },
      });

      if (!existingBook) {
        await prisma.book.create({
          data: {
            ...bookData,
            totalCopies: 5,
            available: 5,
            schoolId: school.id,
            rack: `A${String(Math.floor(Math.random() * 5) + 1)}`,
          },
        });
      }
    }

    // Library Issues — create sample loans for each school
    const schoolBooks = await prisma.book.findMany({
      where: { schoolId: school.id },
      select: { id: true },
    });
    if (schoolBooks.length >= 5) {
      const studentRows = await prisma.student.findMany({
        where: { schoolId: school.id },
        select: { id: true },
        take: 20,
      });
      const now = new Date();
      const makeDate = (daysOffset: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() + daysOffset);
        return d;
      };
      const issueDefinitions = [
        { bookIdx: 0, studentIdx: 0, status: "ISSUED" as const, issueDaysAgo: 10, dueDaysFuture: 4 },
        { bookIdx: 1, studentIdx: 1, status: "ISSUED" as const, issueDaysAgo: 5, dueDaysFuture: 9 },
        { bookIdx: 2, studentIdx: 2, status: "ISSUED" as const, issueDaysAgo: 8, dueDaysFuture: 6 },
        { bookIdx: 3, studentIdx: 3, status: "OVERDUE" as const, issueDaysAgo: 25, dueDaysPast: 10 },
        { bookIdx: 4, studentIdx: 4, status: "RETURNED" as const, issueDaysAgo: 20, returnDaysAgo: 8 },
      ];

      for (const def of issueDefinitions) {
        const bookId = schoolBooks[def.bookIdx].id;
        const studentId = studentRows[def.studentIdx]?.id;
        if (!studentId) continue;
        const existing = await prisma.libraryIssue.findFirst({
          where: { bookId, studentId, status: { not: "RETURNED" } },
        });
        if (existing) continue;

        const issueDate = makeDate(-def.issueDaysAgo);
        const dueDate = "dueDaysPast" in def
          ? makeDate(-def.dueDaysPast)
          : "dueDaysFuture" in def
            ? makeDate(def.dueDaysFuture)
            : makeDate(14);
        const returnDate = "returnDaysAgo" in def ? makeDate(-def.returnDaysAgo) : null;
        const fine = def.status === "OVERDUE" ? "dueDaysPast" in def ? Math.abs(def.dueDaysPast) : 0 : 0;

        await prisma.libraryIssue.create({
          data: {
            bookId,
            studentId,
            issueDate,
            dueDate,
            returnDate,
            status: def.status,
            fine,
            schoolId: school.id,
          },
        });

        // Decrement available for active (non-RETURNED) loans
        if (def.status !== "RETURNED") {
          await prisma.book.update({
            where: { id: bookId },
            data: { available: { decrement: 1 } },
          });
        }
      }
    }

    // Vehicles and routes (extended fleet)
    const vehicleDefs = [
      { registrationNo: `KA-01-${1000 + schoolCount}`, type: "Bus", capacity: 45 },
      { registrationNo: `KA-02-${1000 + schoolCount}`, type: "Bus", capacity: 40 },
      { registrationNo: `KA-03-${1000 + schoolCount}`, type: "Mini Bus", capacity: 24 },
    ];
    const driverDefs = [
      { name: "Ramesh Kumar", phone: "+91 98765 01234", licenseNo: "DL-48291", vehicleIdx: 0 },
      { name: "Suresh Yadav", phone: "+91 98765 52110", licenseNo: "DL-73419", vehicleIdx: 1 },
      { name: "Mahesh Rao", phone: "+91 98765 88220", licenseNo: "DL-91562", vehicleIdx: 2 },
    ];
    const routeDefs = [
      {
        name: "Route 1 - City Center",
        vehicleIdx: 0,
        startTime: "07:30",
        endTime: "08:30",
        stops: [
          { name: "Central Square", lat: 12.9716, lng: 77.5946 },
          { name: "Railway Station", lat: 12.9785, lng: 77.5985 },
          { name: "Market Road", lat: 12.9849, lng: 77.6079 },
          { name: "Garden Colony", lat: 12.9919, lng: 77.6164 },
          { name: "School Gate", lat: 13.0026, lng: 77.6250 },
        ],
      },
      {
        name: "Route 2 - North Side",
        vehicleIdx: 1,
        startTime: "07:15",
        endTime: "08:15",
        stops: [
          { name: "City Gate", lat: 13.0205, lng: 77.5900 },
          { name: "Industrial Town", lat: 13.0240, lng: 77.5985 },
          { name: "Star Park", lat: 13.0165, lng: 77.6120 },
          { name: "Rainbow Lane", lat: 13.0102, lng: 77.6190 },
          { name: "School Gate", lat: 13.0026, lng: 77.6250 },
        ],
      },
      {
        name: "Route 3 - Garden Colony",
        vehicleIdx: 2,
        startTime: "07:45",
        endTime: "08:45",
        stops: [
          { name: "Lake View", lat: 12.9480, lng: 77.5800 },
          { name: "Rose Garden", lat: 12.9585, lng: 77.5890 },
          { name: "Green Park", lat: 12.9690, lng: 77.6005 },
          { name: "Lotus Court", lat: 12.9832, lng: 77.6130 },
          { name: "School Gate", lat: 13.0026, lng: 77.6250 },
        ],
      },
    ];

    const vehicleIds: string[] = [];
    for (const vDef of vehicleDefs) {
      const v = await prisma.vehicle.upsert({
        where: {
          schoolId_registrationNo: {
            schoolId: school.id,
            registrationNo: vDef.registrationNo,
          },
        },
        update: { capacity: vDef.capacity, type: vDef.type },
        create: {
          registrationNo: vDef.registrationNo,
          type: vDef.type,
          capacity: vDef.capacity,
          schoolId: school.id,
        },
      });
      vehicleIds.push(v.id);
    }

    for (const dDef of driverDefs) {
      const existingDriver = await prisma.driver.findFirst({
        where: { schoolId: school.id, name: dDef.name },
      });
      if (!existingDriver) {
        await prisma.driver.create({
          data: {
            name: dDef.name,
            phone: dDef.phone,
            licenseNo: dDef.licenseNo,
            vehicleId: vehicleIds[dDef.vehicleIdx],
            schoolId: school.id,
          },
        });
      }
    }

    const routeIds: string[] = [];
    for (const rDef of routeDefs) {
      let route =
        (await prisma.route.findFirst({ where: { name: rDef.name, schoolId: school.id } })) ||
        (await prisma.route.create({
          data: {
            name: rDef.name,
            vehicleId: vehicleIds[rDef.vehicleIdx],
            schoolId: school.id,
            startTime: rDef.startTime,
            endTime: rDef.endTime,
          },
        }));
      routeIds.push(route.id);

      for (let s = 0; s < rDef.stops.length; s++) {
        const stopDef = rDef.stops[s];
        const existingStop = await prisma.routeStop.findFirst({
          where: { routeId: route.id, position: s },
        });
        if (!existingStop) {
          await prisma.routeStop.create({
            data: {
              routeId: route.id,
              name: stopDef.name,
              position: s,
              time: `${8 + Math.floor(s / 2)}:${s % 2 === 0 ? "00" : "30"}`,
              latitude: stopDef.lat,
              longitude: stopDef.lng,
            },
          });
        }
      }
    }

    // Assign up to 12 students per school to transport routes
    const transportStudents = await prisma.student.findMany({
      where: { schoolId: school.id },
      select: { id: true },
      take: 12,
    });
    const stopPool = await prisma.routeStop.findMany({
      where: { routeId: { in: routeIds }, position: { not: 4 } },
      orderBy: { position: "asc" },
    });
    for (let i = 0; i < transportStudents.length; i++) {
      const rIdx = i % 3;
      const routeId = routeIds[rIdx];
      const stop = stopPool.find(
        (st) => st.routeId === routeId && st.position === i % 4
      );
      const existingTransport = await prisma.studentTransport.findFirst({
        where: { studentId: transportStudents[i].id },
      });
      if (!existingTransport) {
        await prisma.studentTransport.create({
          data: {
            studentId: transportStudents[i].id,
            routeId,
            vehicleId: vehicleIds[rIdx],
            stopId: stop?.id,
            schoolId: school.id,
          },
        });
      }
    }

    // Announcements
    const existingAnnouncement = await prisma.announcement.findFirst({
      where: { schoolId: school.id, title: { contains: "Welcome to the new academic year" } },
    });
    if (!existingAnnouncement) {
      await prisma.announcement.create({
        data: {
          title: `Welcome to the new academic year at ${school.name}`,
          content: "We are excited to welcome all students and parents to the new academic year.",
          target: "ALL",
          schoolId: school.id,
        },
      });
    }

    console.log(`Seeded school: ${school.name} with ${students.length} students`);
  }

  return { superAdmin, schoolCount };
}

async function seedFeeManagement(
  school: { id: string; schoolCode: string },
  academicYear: any,
  classes: Record<string, string>
) {
  // Categories
  const tuitionCat = await prisma.feeCategory.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "Tuition" } },
    update: {},
    create: { name: "Tuition", description: "Monthly tuition fee", schoolId: school.id },
  });

  // Monthly tuition structure per class (tiered)
  const tierOf = (className: string): number => {
    if (className === "LKG" || className === "UKG") return 1500;
    if (["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"].includes(className)) return 2200;
    if (["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"].includes(className)) return 2800;
    return 3500;
  };

  // Move all students of this school to the CURRENT academic year's class,
  // healing data left by older seed runs (students may point to prior-year classes).
  const currentClasses = await prisma.schoolClass.findMany({
    where: { schoolId: school.id, academicYearId: academicYear.id },
    select: { id: true, name: true },
  });
  const classesByName = new Map(currentClasses.map((c) => [c.name, c.id]));
  const allStudents = await prisma.student.findMany({
    where: { schoolId: school.id },
    select: { id: true, classId: true },
  });
  const studentClassIds0 = [...new Set(allStudents.map((s) => s.classId).filter(Boolean))] as string[];
  const studentClasses0 = await prisma.schoolClass.findMany({
    where: { id: { in: studentClassIds0 } },
    select: { id: true, name: true },
  });
  const oldNameById = new Map(studentClasses0.map((c) => [c.id, c.name]));
  let remapped = 0;
  for (const stu of allStudents) {
    if (!stu.classId) continue;
    const name = oldNameById.get(stu.classId);
    const newId = name ? classesByName.get(name) : undefined;
    if (newId && newId !== stu.classId) {
      await prisma.student.update({ where: { id: stu.id }, data: { classId: newId } });
      remapped++;
    }
  }
  if (remapped) console.log(`  Remapped ${remapped} students to current AY classes (${school.schoolCode})`);

  // Move each student's section into their (current) class. Older seed runs left
  // sectionId pointing at a section of a prior-year class with the same name.
  const healStudents = await prisma.student.findMany({
    where: { schoolId: school.id },
    select: { id: true, classId: true, sectionId: true },
  });
  const currentSectionIds = new Set(
    (
      await prisma.section.findMany({
        where: { classId: { in: [...new Set(healStudents.map((s) => s.classId).filter(Boolean))] } },
        select: { id: true },
      })
    ).map((s) => s.id)
  );
  let sectionsHealed = 0;
  for (const stu of healStudents) {
    if (!stu.classId || !stu.sectionId) continue;
    if (currentSectionIds.has(stu.sectionId)) continue;
    const section = await prisma.section.findUnique({
      where: { id: stu.sectionId },
      select: { name: true },
    });
    if (!section) continue;
    const target = await prisma.section.findFirst({
      where: { classId: stu.classId, name: section.name },
      select: { id: true },
    });
    if (target) {
      await prisma.student.update({ where: { id: stu.id }, data: { sectionId: target.id } });
      sectionsHealed++;
    }
  }
  if (sectionsHealed) console.log(`  Healed ${sectionsHealed} student sections to current AY classes (${school.schoolCode})`);

  // All students
  const studentRecords = await prisma.student.findMany({
    where: { schoolId: school.id },
    select: { id: true, classId: true, admissionNumber: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  // Build monthly structures keyed by the students' ACTUAL class ids
  // (students may still reference classes from a prior academic year).
  const studentClassIds = [...new Set(studentRecords.map((s) => s.classId).filter(Boolean))] as string[];
  const realClasses = await prisma.schoolClass.findMany({
    where: { id: { in: studentClassIds } },
    select: { id: true, name: true },
  });

  const structureIds: Record<string, string> = {};
  const classNameById: Record<string, string> = {};
  for (const cls of realClasses) {
    classNameById[cls.id] = cls.name;
    const existing = await prisma.feeStructure.findFirst({
      where: {
        schoolId: school.id,
        name: `Monthly Tuition ${cls.name}`,
        academicYearId: academicYear.id,
      },
    });
    structureIds[cls.id] =
      existing?.id ||
      (
        await prisma.feeStructure.create({
          data: {
            name: `Monthly Tuition ${cls.name}`,
            amount: tierOf(cls.name),
            feeCategoryId: tuitionCat.id,
            feeType: "MONTHLY",
            classId: cls.id,
            academicYearId: academicYear.id,
            schoolId: school.id,
          },
        })
      ).id;
  }

  const ayShort = "2026-27";
  const months = [4, 5, 6, 7, 8]; // Apr – Aug 2026 (5 months)
  let seq = 0;
  let createdCount = 0;
  let skippedCount = 0;

  const invoiceNumberFor = () => {
    seq += 1;
    return `INV/${ayShort}/${String(seq).padStart(6, "0")}`;
  };

  const paymentMethodsForMonth = (m: number): any =>
    m % 4 === 0 ? "CASH" : m % 4 === 1 ? "UPI" : m % 4 === 2 ? "BANK_TRANSFER" : "CARD";

  for (let idx = 0; idx < studentRecords.length; idx++) {
    const rec = studentRecords[idx];
    const structureId = rec.classId ? structureIds[rec.classId] : undefined;
    if (!structureId) continue;

    const amount = tierOf(rec.classId ? classNameById[rec.classId] || "Class 1" : "Class 1");

    for (const month of months) {
      const dueDate = new Date(2026, month, 10); // 10th of following month
      const invoiceNumber = invoiceNumberFor();

      const existing = await prisma.invoice.findUnique({
        where: { schoolId_invoiceNumber: { schoolId: school.id, invoiceNumber } },
      });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const isPaidAll = idx % 3 === 0; // paid in full
      const isPartial = idx % 3 === 1; // paid Apr–Jun, pending Jul–Aug
      const paid = isPaidAll ? amount : isPartial && month <= 6 ? amount : 0;
      const applyFine = idx % 3 === 2 && (month === 4 || month === 5) ? 500 : isPartial && month === 8 ? 300 : 0;

      const status = paid >= amount ? "PAID" : "OVERDUE";

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          studentId: rec.id,
          feeStructureId: structureId,
          academicYearId: academicYear.id,
          schoolId: school.id,
          totalAmount: amount,
          paidAmount: paid,
          fine: applyFine,
          feeMonth: month,
          feeYear: 2026,
          status,
          dueDate,
          paidAt: paid > 0 ? new Date(2026, month, 12) : null,
          items: {
            create: {
              feeCategoryId: tuitionCat.id,
              description: `Monthly tuition fee ${month}/2026`,
              amount,
            },
          },
          fineHistories: applyFine
            ? {
                create: {
                  previousFine: 0,
                  newFine: applyFine,
                  reason: applyFine === 300 ? "Overdue monthly fee" : "Late payment (2 months)",
                },
              }
            : undefined,
        },
      });

      createdCount += 1;

      if (paid > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: paid,
            method: paymentMethodsForMonth(month),
            transactionId: `TXN-${school.schoolCode}-${invoice.invoiceNumber}`,
            status: "COMPLETED",
            paidAt: new Date(2026, month, 12),
            schoolId: school.id,
          },
        });
      }
    }
  }

  // Keep the per-year invoice sequence in sync so "generate invoices"
  // continues from the last seeded number instead of colliding.
  const existingSeq = await prisma.invoiceSequence.findUnique({
    where: { schoolId_academicYearId: { schoolId: school.id, academicYearId: academicYear.id } },
  });
  await prisma.invoiceSequence.upsert({
    where: { schoolId_academicYearId: { schoolId: school.id, academicYearId: academicYear.id } },
    update: { sequence: Math.max(existingSeq?.sequence || 0, seq) },
    create: { schoolId: school.id, academicYearId: academicYear.id, sequence: seq },
  });

  console.log(`  Fee management seeded for ${school.schoolCode} (${studentRecords.length} students x 5 monthly invoices, created=${createdCount} skipped=${skippedCount})`);
}

async function main() {
  console.log("Starting database seed...");

  const roles = await seedRoles();
  await seedPermissions(roles);
  await seedSubscriptionPlans();
  await seedSchoolsAndData();

  console.log("=".repeat(50));
  console.log("SEED COMPLETE");
  console.log("=".repeat(50));
  console.log("\nDemo Logins:");
  console.log("  Super Admin: admin@schoolsphere.test / Admin@2024");
  console.log("  School Admin: admin@gis001.test / School@2024");
  console.log("  Teacher: teacher1@gis001.test / School@2024");
  console.log("  Parent: parent1@gis001.test / School@2024");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });