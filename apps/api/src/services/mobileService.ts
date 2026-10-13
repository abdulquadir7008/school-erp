import { prisma } from "../config/database";
import { NotFoundError, TenantError, AuthorizationError } from "../utils/errors";
import { AuthUser } from "../types";

async function resolveStudent(auth: AuthUser) {
  if (auth.studentId) {
    const s = await prisma.student.findUnique({
      where: { id: auth.studentId },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        school: { select: { id: true, name: true, schoolCode: true, logo: true } },
      },
    });
    if (s) {
      if (auth.schoolId && s.schoolId !== auth.schoolId) throw new TenantError();
      return s;
    }
  }
  // legacy fallback: match by email
  const byEmail = await prisma.student.findFirst({
    where: { email: auth.email, schoolId: auth.schoolId || undefined },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      school: { select: { id: true, name: true, schoolCode: true, logo: true } },
    },
  });
  if (!byEmail) throw new NotFoundError("Linked student record");
  return byEmail;
}

async function resolveTeacher(auth: AuthUser) {
  if (auth.teacherId) {
    const t = await prisma.teacher.findUnique({
      where: { id: auth.teacherId },
      include: { school: { select: { id: true, name: true, schoolCode: true, logo: true } } },
    });
    if (t) {
      if (auth.schoolId && t.schoolId !== auth.schoolId) throw new TenantError();
      return t;
    }
  }
  const byEmail = await prisma.teacher.findFirst({
    where: { email: auth.email, schoolId: auth.schoolId || undefined },
    include: { school: { select: { id: true, name: true, schoolCode: true, logo: true } } },
  });
  if (!byEmail) throw new NotFoundError("Linked teacher record");
  return byEmail;
}

function requireRole(auth: AuthUser, roles: string[]) {
  if (!roles.includes(auth.roleName)) throw new AuthorizationError("Not allowed for this role");
}

function dayOfWeek(date = new Date()): number {
  const d = date.getDay(); // 0 Sun .. 6 Sat
  return d === 0 ? 7 : d; // schema uses 1-7 presumably Mon-Sun
}

export const mobileService = {
  resolveStudent,
  resolveTeacher,

  /* ---------- STUDENT ---------- */

  async studentMe(auth: AuthUser) {
    requireRole(auth, ["STUDENT", "PARENT"]);
    const s = await resolveStudent(auth);
    const transport = await prisma.studentTransport.findFirst({
      where: { studentId: s.id },
      include: {
        route: { select: { id: true, name: true, startTime: true, endTime: true } },
        vehicle: { select: { id: true, registrationNo: true, type: true } },
      },
    });
    return { ...s, transport };
  },

  async studentDashboard(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    const dow = dayOfWeek();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [timetable, attendanceToday, attendanceAll, homework, assignments, exams, announcements, invoices] =
      await Promise.all([
        prisma.timetable.findMany({
          where: { classId: s.classId, dayOfWeek: dow },
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { startTime: "asc" },
        }),
        prisma.attendance.findFirst({
          where: { studentId: s.id, date: { gte: today } },
          select: { status: true, date: true },
        }),
        prisma.attendance.findMany({ where: { studentId: s.id }, select: { status: true } }),
        prisma.homework.findMany({
          where: { classId: s.classId },
          orderBy: { dueDate: "asc" }, take: 10,
        }),
        prisma.assignment.findMany({
          where: { classId: s.classId },
          orderBy: { dueDate: "asc" }, take: 10,
        }),
        prisma.exam.findMany({
          where: { schoolId: s.schoolId, status: { in: ["SCHEDULED", "IN_PROGRESS", "PUBLISHED"] } },
          orderBy: { startDate: "asc" }, take: 5,
          include: { subjects: { include: { subject: { select: { name: true } } } } },
        }),
        prisma.announcement.findMany({
          where: { schoolId: s.schoolId },
          orderBy: { publishAt: "desc" }, take: 10,
        }),
        prisma.invoice.findMany({
          where: { studentId: s.id, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
          select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, status: true, dueDate: true },
        }),
      ]);

    const present = attendanceAll.filter((a) => ["PRESENT", "LATE", "HALF_DAY"].includes(a.status)).length;
    const pct = attendanceAll.length ? Math.round((present / attendanceAll.length) * 100) : 0;

    // recent published results for this student
    const marks = await prisma.mark.findMany({
      where: { studentId: s.id, examSubject: { exam: { schoolId: s.schoolId, status: "PUBLISHED" } } },
      include: {
        examSubject: {
          include: {
            exam: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      student: {
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        admissionNumber: s.admissionNumber, photo: s.photo,
        class: s.class, section: s.section, school: s.school,
      },
      todayTimetable: timetable,
      attendanceToday: attendanceToday ?? null,
      attendancePercentage: pct,
      attendanceCounts: {
        total: attendanceAll.length,
        present: attendanceAll.filter((a) => a.status === "PRESENT").length,
        absent: attendanceAll.filter((a) => a.status === "ABSENT").length,
        late: attendanceAll.filter((a) => a.status === "LATE").length,
      },
      upcomingExams: exams,
      recentResults: marks,
      pendingHomework: homework,
      pendingAssignments: assignments,
      announcements,
      feesDue: invoices,
    };
  },

  async studentTimetable(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    return prisma.timetable.findMany({
      where: { classId: s.classId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  },

  async studentAttendance(auth: AuthUser, query: { month?: number; year?: number }) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    const where: any = { studentId: s.id };
    if (query.month && query.year) {
      const start = new Date(query.year, query.month - 1, 1);
      const end = new Date(query.year, query.month, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }
    const records = await prisma.attendance.findMany({
      where, orderBy: { date: "desc" }, take: 200,
    });
    const present = records.filter((a) => ["PRESENT", "LATE", "HALF_DAY"].includes(a.status)).length;
    return {
      records,
      summary: {
        total: records.length, present,
        absent: records.filter((a) => a.status === "ABSENT").length,
        late: records.filter((a) => a.status === "LATE").length,
        percentage: records.length ? Math.round((present / records.length) * 100) : 0,
      },
    };
  },

  async studentHomework(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    const [homework, assignments] = await Promise.all([
      prisma.homework.findMany({ where: { classId: s.classId }, orderBy: { dueDate: "asc" }, take: 100 }),
      prisma.assignment.findMany({
        where: { classId: s.classId }, orderBy: { dueDate: "asc" }, take: 100,
        include: { subject: { select: { id: true, name: true } } },
      }),
    ]);
    return { homework, assignments };
  },

  async studentExams(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    return prisma.exam.findMany({
      where: { schoolId: s.schoolId, status: { in: ["SCHEDULED", "IN_PROGRESS", "PUBLISHED"] } },
      orderBy: { startDate: "asc" }, take: 50,
      include: { subjects: { include: { subject: { select: { id: true, name: true, code: true } } } } },
    });
  },

  async studentResults(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    // ONLY published results — enforced here, never trust client
    const marks = await prisma.mark.findMany({
      where: { studentId: s.id, examSubject: { exam: { schoolId: s.schoolId, status: "PUBLISHED" } } },
      include: {
        examSubject: {
          include: {
            exam: { select: { id: true, name: true, type: true, status: true } },
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    // group by exam
    const byExam = new Map<string, any>();
    for (const m of marks as any[]) {
      const e = m.examSubject.exam;
      if (!byExam.has(e.id)) byExam.set(e.id, { exam: e, subjects: [], totalObtained: 0, totalMax: 0 });
      const g = byExam.get(e.id);
      g.subjects.push({
        subject: m.examSubject.subject, obtained: m.marksObtained,
        maxMarks: m.examSubject.maxMarks, passMarks: m.examSubject.passMarks,
        remarks: m.remarks,
      });
      g.totalObtained += m.marksObtained || 0;
      g.totalMax += m.examSubject.maxMarks;
    }
    return Array.from(byExam.values()).map((g) => ({
      ...g,
      percentage: g.totalMax ? Math.round((g.totalObtained / g.totalMax) * 100) : 0,
    }));
  },

  async studentFees(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    const invoices = await prisma.invoice.findMany({
      where: { studentId: s.id },
      include: { items: true, payments: { orderBy: { paidAt: "desc" } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    const totalDue = invoices
      .filter((i) => ["PENDING", "PARTIAL", "OVERDUE"].includes(i.status))
      .reduce((sum, i) => sum + Number(i.totalAmount) + Number(i.fine) - Number(i.paidAmount) - Number(i.discount), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
    return { invoices, summary: { totalDue, totalPaid, count: invoices.length } };
  },

  async studentLibrary(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    const [issued, catalog] = await Promise.all([
      prisma.libraryIssue.findMany({
        where: { studentId: s.id },
        include: { book: { select: { id: true, title: true, author: true, isbn: true } } },
        orderBy: { issueDate: "desc" }, take: 100,
      }),
      prisma.book.findMany({
        where: { schoolId: s.schoolId },
        orderBy: { title: "asc" }, take: 100,
        select: { id: true, title: true, author: true, category: true, available: true, totalCopies: true },
      }),
    ]);
    return { issued, catalog };
  },

  async studentTransport(auth: AuthUser) {
    requireRole(auth, ["STUDENT"]);
    const s = await resolveStudent(auth);
    const a = await prisma.studentTransport.findFirst({
      where: { studentId: s.id },
      include: {
        route: { include: { stops: { orderBy: { position: "asc" } } } },
        vehicle: { include: { driver: true } },
      },
    });
    if (!a) return null;
    return a;
  },

  /* ---------- TEACHER ---------- */

  async teacherMe(auth: AuthUser) {
    requireRole(auth, ["TEACHER"]);
    const t = await resolveTeacher(auth);
    const classes = await prisma.timetable.findMany({
      where: { teacherId: t.id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });
    const classMap = new Map<string, any>();
    for (const c of classes) {
      const key = `${c.class.id}:${c.subject.id}`;
      if (!classMap.has(key)) classMap.set(key, { class: c.class, subject: c.subject, periods: 0 });
      classMap.get(key).periods += 1;
    }
    return { ...t, assignedClasses: Array.from(classMap.values()) };
  },

  async teacherDashboard(auth: AuthUser) {
    requireRole(auth, ["TEACHER"]);
    const t = await resolveTeacher(auth);
    const dow = dayOfWeek();
    const [todayClasses, allEntries, homework, exams, announcements] = await Promise.all([
      prisma.timetable.findMany({
        where: { teacherId: t.id, dayOfWeek: dow },
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.timetable.findMany({
        where: { teacherId: t.id },
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      }),
      prisma.homework.findMany({
        where: { schoolId: t.schoolId }, orderBy: { createdAt: "desc" }, take: 10,
      }),
      prisma.exam.findMany({
        where: { schoolId: t.schoolId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
        orderBy: { startDate: "asc" }, take: 5,
      }),
      prisma.announcement.findMany({
        where: { schoolId: t.schoolId }, orderBy: { publishAt: "desc" }, take: 10,
      }),
    ]);
    const classIds = Array.from(new Set(allEntries.map((e) => e.classId)));
    const totalStudents = classIds.length
      ? await prisma.student.count({ where: { classId: { in: classIds }, schoolId: t.schoolId, status: "ACTIVE" } })
      : 0;
    return {
      teacher: { id: t.id, firstName: t.firstName, lastName: t.lastName, employeeId: t.employeeId, school: t.school },
      todayClasses, totalClasses: classIds.length, totalStudents,
      totalSubjects: new Set(allEntries.map((e) => e.subjectId)).size,
      upcomingExams: exams, recentHomework: homework, announcements,
    };
  },

  async teacherClasses(auth: AuthUser) {
    requireRole(auth, ["TEACHER"]);
    const t = await resolveTeacher(auth);
    const entries = await prisma.timetable.findMany({
      where: { teacherId: t.id },
      include: {
        class: { include: { sections: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return entries;
  },

  async teacherStudents(auth: AuthUser, classId?: string, sectionId?: string) {
    requireRole(auth, ["TEACHER"]);
    const t = await resolveTeacher(auth);
    // enforce assignment: teacher must teach this class (via timetable)
    if (classId) {
      const assigned = await prisma.timetable.findFirst({ where: { teacherId: t.id, classId } });
      if (!assigned) throw new AuthorizationError("Not assigned to this class");
    } else {
      const all = await prisma.timetable.findMany({ where: { teacherId: t.id }, select: { classId: true } });
      const ids = Array.from(new Set(all.map((a) => a.classId)));
      if (!ids.length) return [];
      const where: any = { schoolId: t.schoolId, classId: { in: ids }, status: "ACTIVE" };
      if (sectionId) where.sectionId = sectionId;
      return prisma.student.findMany({
        where,
        orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
        select: {
          id: true, firstName: true, lastName: true, admissionNumber: true,
          rollNumber: true, photo: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        take: 500,
      });
    }
    const where: any = { schoolId: t.schoolId, classId, status: "ACTIVE" };
    if (sectionId) where.sectionId = sectionId;
    return prisma.student.findMany({
      where,
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, admissionNumber: true,
        rollNumber: true, photo: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      take: 500,
    });
  },

  async teacherExams(auth: AuthUser) {
    requireRole(auth, ["TEACHER"]);
    const t = await resolveTeacher(auth);
    return prisma.exam.findMany({
      where: { schoolId: t.schoolId, status: { in: ["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "PUBLISHED"] } },
      orderBy: { startDate: "desc" },
      take: 50,
      include: { subjects: { include: { subject: { select: { id: true, name: true, code: true } } } } },
    });
  },

  async teacherTimetable(auth: AuthUser) {
    requireRole(auth, ["TEACHER"]);
    const t = await resolveTeacher(auth);
    return prisma.timetable.findMany({
      where: { teacherId: t.id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  },

  async notifications(auth: AuthUser) {
    return prisma.notification.findMany({
      where: { userId: auth.id },
      orderBy: { createdAt: "desc" }, take: 50,
    });
  },

  async announcements(auth: AuthUser) {
    if (!auth.schoolId) throw new TenantError("School context required");
    return prisma.announcement.findMany({
      where: { schoolId: auth.schoolId },
      orderBy: { publishAt: "desc" }, take: 50,
    });
  },
};
