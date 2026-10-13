import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  AuthorizationError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

async function resolveTeacherId(auth: AuthUser): Promise<string | null> {
  if (auth.teacherId) return auth.teacherId;
  const t = await prisma.teacher.findFirst({
    where: { email: auth.email, schoolId: auth.schoolId || undefined },
    select: { id: true },
  });
  return t?.id ?? null;
}

async function assertTeacherAssigned(auth: AuthUser, classId: string) {
  const teacherId = await resolveTeacherId(auth);
  if (!teacherId) throw new AuthorizationError("No linked teacher record");
  const assigned = await prisma.timetable.findFirst({
    where: { teacherId, classId },
    select: { id: true },
  });
  if (!assigned) throw new AuthorizationError("Not assigned to this class");
  return teacherId;
}

function scope(auth: AuthUser, schoolId?: string) {
  const ctx = auth.isSuperAdmin ? schoolId : auth.schoolId || undefined;
  if (!ctx && !auth.isSuperAdmin) throw new TenantError("School context required");
  return ctx;
}

async function assertSameSchool(
  schoolId: string | undefined,
  entitySchoolId: string,
  entityName: string
) {
  if (schoolId && entitySchoolId !== schoolId) {
    throw new TenantError(`${entityName} belongs to another school`);
  }
}

export const academicsService = {
  /* ---------------- Timetable ---------------- */

  async listTimetable(auth: AuthUser, query: { classId?: string; teacherId?: string; schoolId?: string }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.schoolId && auth.isSuperAdmin) where.schoolId = query.schoolId;

    if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      where.teacherId = teacherId || "__none__";
    } else if (query.teacherId) {
      where.teacherId = query.teacherId;
    }
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    }
    return prisma.timetable.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 500,
    });
  },

  async createTimetable(auth: AuthUser, data: {
    classId: string; subjectId: string; teacherId: string;
    dayOfWeek: number; startTime: string; endTime: string;
    room?: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, data.schoolId);
    if (!schoolId) throw new TenantError("School context required");
    const [cls, subject, teacher] = await Promise.all([
      prisma.schoolClass.findUnique({ where: { id: data.classId } }),
      prisma.subject.findUnique({ where: { id: data.subjectId } }),
      prisma.teacher.findUnique({ where: { id: data.teacherId } }),
    ]);
    if (!cls) throw new NotFoundError("Class");
    if (!subject) throw new NotFoundError("Subject");
    if (!teacher) throw new NotFoundError("Teacher");
    await assertSameSchool(schoolId, cls.schoolId, "Class");
    await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    await assertSameSchool(schoolId, teacher.schoolId, "Teacher");

    const entry = await prisma.timetable.create({
      data: {
        schoolId,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "TIMETABLE",
        entityId: entry.id, schoolId, newValue: { classId: data.classId, subjectId: data.subjectId },
      },
    });
    return entry;
  },

  async deleteTimetable(auth: AuthUser, id: string) {
    const entry = await prisma.timetable.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Timetable entry");
    const schoolId = scope(auth);
    await assertSameSchool(schoolId, entry.schoolId, "Timetable entry");
    await prisma.timetable.delete({ where: { id } });
    return { success: true };
  },

  /* ---------------- Homework ---------------- */

  async listHomework(auth: AuthUser, query: { classId?: string; schoolId?: string }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    } else if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      const entries = teacherId
        ? await prisma.timetable.findMany({ where: { teacherId }, select: { classId: true } })
        : [];
      const ids = Array.from(new Set(entries.map((e) => e.classId)));
      where.classId = { in: ids.length ? ids : ["__none__"] };
    }
    return prisma.homework.findMany({
      where,
      orderBy: { dueDate: "asc" },
      take: 200,
    });
  },

  async createHomework(auth: AuthUser, data: {
    title: string; description?: string; classId: string;
    subjectId?: string; dueDate: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, data.schoolId);
    if (!schoolId) throw new TenantError("School context required");
    const cls = await prisma.schoolClass.findUnique({ where: { id: data.classId } });
    if (!cls) throw new NotFoundError("Class");
    await assertSameSchool(schoolId, cls.schoolId, "Class");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, data.classId);
    }
    const hw = await prisma.homework.create({
      data: {
        title: data.title,
        description: data.description,
        classId: data.classId,
        subjectId: data.subjectId,
        dueDate: new Date(data.dueDate),
        schoolId,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "HOMEWORK",
        entityId: hw.id, schoolId, newValue: { title: hw.title, classId: data.classId },
      },
    });
    return hw;
  },

  /* ---------------- Assignments ---------------- */

  async listAssignments(auth: AuthUser, query: { classId?: string; schoolId?: string }) {
    const schoolId = scope(auth, query.schoolId);
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (query.classId) {
      const cls = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!cls) throw new NotFoundError("Class");
      await assertSameSchool(schoolId, cls.schoolId, "Class");
      where.classId = query.classId;
    } else if (auth.roleName === "TEACHER") {
      const teacherId = await resolveTeacherId(auth);
      const entries = teacherId
        ? await prisma.timetable.findMany({ where: { teacherId }, select: { classId: true } })
        : [];
      const ids = Array.from(new Set(entries.map((e) => e.classId)));
      where.classId = { in: ids.length ? ids : ["__none__"] };
    }
    return prisma.assignment.findMany({
      where,
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 200,
    });
  },

  async createAssignment(auth: AuthUser, data: {
    title: string; description?: string; classId: string;
    subjectId?: string; totalMarks?: number; dueDate: string; schoolId?: string;
  }) {
    const schoolId = scope(auth, data.schoolId);
    if (!schoolId) throw new TenantError("School context required");
    const cls = await prisma.schoolClass.findUnique({ where: { id: data.classId } });
    if (!cls) throw new NotFoundError("Class");
    await assertSameSchool(schoolId, cls.schoolId, "Class");
    if (auth.roleName === "TEACHER") {
      await assertTeacherAssigned(auth, data.classId);
    }
    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
      if (!subject) throw new NotFoundError("Subject");
      await assertSameSchool(schoolId, (subject as any).schoolId, "Subject");
    }
    const a = await prisma.assignment.create({
      data: {
        title: data.title,
        description: data.description,
        classId: data.classId,
        subjectId: data.subjectId,
        totalMarks: data.totalMarks,
        dueDate: new Date(data.dueDate),
        schoolId,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: auth.id, action: "CREATE", entity: "ASSIGNMENT",
        entityId: a.id, schoolId, newValue: { title: a.title, classId: data.classId },
      },
    });
    return a;
  },
};
