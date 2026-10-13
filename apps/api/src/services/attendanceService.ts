import { prisma } from "../config/database";
import { AuthUser } from "../types";
import { AuthorizationError, TenantError } from "../utils/errors";

interface AttendanceRecord {
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
  remarks?: string;
}

/**
 * Teachers may only roster/mark classes assigned to them via the timetable.
 * School admins and other staff bypass this check (school scoping still applies).
 */
async function assertTeacherAssigned(auth: AuthUser | undefined, classId: string) {
  if (!auth || auth.isSuperAdmin || auth.roleName !== "TEACHER") return;
  const teacherId =
    auth.teacherId ||
    (
      await prisma.teacher.findFirst({
        where: { email: auth.email, schoolId: auth.schoolId || undefined },
        select: { id: true },
      })
    )?.id;
  if (!teacherId) throw new AuthorizationError("No linked teacher record");
  const assigned = await prisma.timetable.findFirst({
    where: { teacherId, classId },
    select: { id: true },
  });
  if (!assigned) throw new AuthorizationError("Not assigned to this class");
}

export const attendanceService = {
  async roster(query: {
    classId: string;
    sectionId?: string;
    date?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
    auth?: AuthUser;
  }) {
    if (!query.classId) {
      throw new TenantError("Class selection required");
    }

    if (!query.schoolId && !query.isSuperAdmin) {
      throw new TenantError("School context required");
    }

    const where: any = {
      classId: query.classId,
      status: "ACTIVE",
    };
    if (query.sectionId) {
      where.sectionId = query.sectionId;
    }

    const classRecord = await prisma.schoolClass.findUnique({
      where: { id: query.classId },
      select: { schoolId: true, name: true },
    });

    if (!classRecord) {
      throw new TenantError("Class not found");
    }

    if (!query.isSuperAdmin && query.schoolId && classRecord.schoolId !== query.schoolId) {
      throw new TenantError();
    }

    // Teachers can only pull rosters for their assigned classes.
    await assertTeacherAssigned(query.auth, query.classId);

    const date = query.date ? new Date(query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const [students, existing] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          rollNumber: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      }),
      prisma.attendance.findMany({
        where: {
          schoolId: classRecord.schoolId,
          date: { gte: start, lte: end },
        },
        select: {
          studentId: true,
          status: true,
          remarks: true,
          id: true,
        },
      }),
    ]);

    const attendanceMap = new Map(
      existing.map((record) => [record.studentId, record])
    );

    return {
      students: students.map((student) => {
        const record = attendanceMap.get(student.id);
        return {
          ...student,
          attendance: record
            ? {
                id: record.id,
                status: record.status,
                remarks: record.remarks,
              }
            : null,
        };
      }),
    };
  },

  async bulkCreate(data: {
    date: string;
    schoolId: string;
    classId?: string;
    records: AttendanceRecord[];
    markedBy?: string;
    auth?: AuthUser;
  }) {
    const date = new Date(data.date);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return prisma.$transaction(async (tx) => {
      const studentIds = data.records.map((r) => r.studentId);

      const students = await tx.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, schoolId: true, classId: true, admissionNumber: true },
      });

      const studentSchool = new Map(
        students.map((s) => [s.id, s.schoolId])
      );

      for (const record of data.records) {
        const schoolId = studentSchool.get(record.studentId);
        if (!schoolId) {
          throw new TenantError("Student not found");
        }
        if (schoolId !== data.schoolId) {
          throw new TenantError("Student does not belong to this school");
        }
      }

      // When a class scope is supplied, every record must belong to it and
      // teachers must be assigned to it — IDs from the client are not trusted.
      if (data.classId) {
        const classRecord = await tx.schoolClass.findUnique({
          where: { id: data.classId },
          select: { schoolId: true },
        });
        if (!classRecord) throw new TenantError("Class not found");
        if (classRecord.schoolId !== data.schoolId) throw new TenantError();
        for (const s of students) {
          if ((s as any).classId !== data.classId) {
            throw new TenantError("Student does not belong to this class");
          }
        }
        await assertTeacherAssigned(data.auth, data.classId);
      } else if (data.auth && !data.auth.isSuperAdmin && data.auth.roleName === "TEACHER") {
        // Without an explicit class scope, still confine teachers to
        // students of their assigned classes.
        const teacherId =
          data.auth.teacherId ||
          (
            await tx.teacher.findFirst({
              where: { email: data.auth.email, schoolId: data.auth.schoolId || undefined },
              select: { id: true },
            })
          )?.id;
        if (!teacherId) throw new AuthorizationError("No linked teacher record");
        const assigned = await tx.timetable.findMany({
          where: { teacherId },
          select: { classId: true },
        });
        const allowed = new Set(assigned.map((a) => a.classId));
        for (const s of students) {
          if (!allowed.has((s as any).classId)) {
            throw new AuthorizationError("Not assigned to this student's class");
          }
        }
      }

      const existing = await tx.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          date: { gte: start, lte: end },
        },
        select: { id: true, studentId: true },
      });

      const existingMap = new Map(
        existing.map((record) => [record.studentId, record.id])
      );

      for (const record of data.records) {
        const schoolId = studentSchool.get(record.studentId)!;
        if (existingMap.has(record.studentId)) {
          await tx.attendance.update({
            where: { id: existingMap.get(record.studentId)! },
            data: {
              status: record.status,
              remarks: record.remarks,
              markedBy: data.markedBy,
            },
          });
        } else {
          await tx.attendance.create({
            data: {
              studentId: record.studentId,
              date,
              status: record.status,
              remarks: record.remarks,
              markedBy: data.markedBy,
              schoolId,
            },
          });
        }
      }

      return { success: true, updated: data.records.length };
    });
  },

  async stats(query: {
    classId?: string;
    date?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
    auth?: AuthUser;
  }) {
    if (!query.schoolId && !query.isSuperAdmin) {
      throw new TenantError("School context required");
    }

    // Verify class tenancy before scoping by it (no silent cross-school reads).
    if (query.classId && !query.isSuperAdmin && query.schoolId) {
      const classRecord = await prisma.schoolClass.findUnique({
        where: { id: query.classId },
        select: { schoolId: true },
      });
      if (!classRecord) throw new TenantError("Class not found");
      if (classRecord.schoolId !== query.schoolId) throw new TenantError();
      await assertTeacherAssigned(query.auth, query.classId);
    }

    const date = query.date ? new Date(query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      date: { gte: start, lte: end },
      schoolId: query.schoolId,
    };

    if (query.classId) {
      const classStudents = await prisma.student.findMany({
        where: { classId: query.classId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!classStudents.length) {
        return {
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          leave: 0,
          percentage: 0,
          unmarked: 0,
        };
      }
      where.studentId = { in: classStudents.map((s) => s.id) };
    }

    const records = await prisma.attendance.findMany({
      where,
      select: { status: true },
    });

    const counts = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      HALF_DAY: 0,
      LEAVE: 0,
    };

    for (const record of records) {
      counts[record.status] += 1;
    }

    if (query.classId) {
      const classStudents = await prisma.student.count({
        where: { classId: query.classId, status: "ACTIVE" },
      });
      const marked = records.length;
      return {
        total: classStudents,
        present: counts.PRESENT,
        absent: counts.ABSENT,
        late: counts.LATE,
        halfDay: counts.HALF_DAY,
        leave: counts.LEAVE,
        unmarked: Math.max(0, classStudents - marked),
        percentage: classStudents
          ? Math.round(((counts.PRESENT + counts.LATE + counts.HALF_DAY) / classStudents) * 100)
          : 0,
      };
    }

    return {
      total: records.length,
      present: counts.PRESENT,
      absent: counts.ABSENT,
      late: counts.LATE,
      halfDay: counts.HALF_DAY,
      leave: counts.LEAVE,
      unmarked: 0,
      percentage: records.length
        ? Math.round(((counts.PRESENT + counts.LATE + counts.HALF_DAY) / records.length) * 100)
        : 0,
    };
  },
};