import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

// Standard K-12 structure seeded for every school (mirrors prisma/seed.ts).
const DEFAULT_CLASSES: { name: string; code: string }[] = [
  { name: "LKG", code: "LKG" },
  { name: "UKG", code: "UKG" },
  { name: "Class 1", code: "C1" },
  { name: "Class 2", code: "C2" },
  { name: "Class 3", code: "C3" },
  { name: "Class 4", code: "C4" },
  { name: "Class 5", code: "C5" },
  { name: "Class 6", code: "C6" },
  { name: "Class 7", code: "C7" },
  { name: "Class 8", code: "C8" },
  { name: "Class 9", code: "C9" },
  { name: "Class 10", code: "C10" },
  { name: "Class 11", code: "C11" },
  { name: "Class 12", code: "C12" },
];

const DEFAULT_SECTIONS = ["A"];

/** April → March session containing today, e.g. AY 2026-27. */
function currentSession() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `AY ${startYear}-${String(startYear + 1).slice(2)}`,
    startDate: new Date(startYear, 3, 1),
    endDate: new Date(startYear + 1, 2, 31),
  };
}

/** Tenant guard: super admins may target any school, everyone else only
 *  their own school. Throws instead of leaking other schools' existence. */
function resolveSchoolId(user: AuthUser, paramSchoolId: string): string {
  if (user.isSuperAdmin) {
    if (!paramSchoolId) throw new TenantError("A schoolId parameter is required");
    return paramSchoolId;
  }
  if (!user.schoolId || user.schoolId !== paramSchoolId) {
    throw new NotFoundError("School");
  }
  return user.schoolId;
}

type Tx = Prisma.TransactionClient;

async function ensureAcademicYear(
  db: Tx,
  schoolId: string,
  academicYearId?: string
) {
  if (academicYearId) {
    const year = await db.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!year) throw new NotFoundError("Academic year");
    return year;
  }

  const current =
    (await db.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    })) ||
    (await db.academicYear.findFirst({
      where: { schoolId },
      orderBy: { startDate: "desc" },
    }));
  if (current) return current;

  const session = currentSession();
  return db.academicYear.create({
    data: {
      name: session.name,
      startDate: session.startDate,
      endDate: session.endDate,
      isCurrent: true,
      schoolId,
    },
  });
}

export const classService = {
  /** One-click (and registration-time) setup: academic year + LKG–12
   *  classes + Section A. Idempotent — existing rows are reused. */
  async setupDefaults(user: AuthUser, paramSchoolId: string) {
    const schoolId = resolveSchoolId(user, paramSchoolId);

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!school) throw new NotFoundError("School");

    return prisma.$transaction(async (tx) => {
      const year = await ensureAcademicYear(tx, schoolId);
      let createdClasses = 0;
      let createdSections = 0;

      for (const { name, code } of DEFAULT_CLASSES) {
        let cls = await tx.schoolClass.findUnique({
          where: {
            schoolId_academicYearId_code: {
              schoolId,
              academicYearId: year.id,
              code,
            },
          },
        });
        if (!cls) {
          cls = await tx.schoolClass.create({
            data: { name, code, schoolId, academicYearId: year.id },
          });
          createdClasses += 1;
        }

        for (const sectionName of DEFAULT_SECTIONS) {
          const existing = await tx.section.findUnique({
            where: { classId_name: { classId: cls.id, name: sectionName } },
          });
          if (!existing) {
            await tx.section.create({
              data: { name: sectionName, classId: cls.id },
            });
            createdSections += 1;
          }
        }
      }

      return {
        academicYear: { id: year.id, name: year.name },
        classes: DEFAULT_CLASSES.length,
        createdClasses,
        createdSections,
      };
    },
    // Generous timeout: 14 classes + sections over a free-tier connection
    // can exceed Prisma's 5s default interactive-transaction timeout.
    { timeout: 30000 });
  },

  async createClass(
    user: AuthUser,
    paramSchoolId: string,
    data: { name: string; code: string; academicYearId?: string }
  ) {
    const schoolId = resolveSchoolId(user, paramSchoolId);
    const code = data.code.trim().toUpperCase();

    return prisma.$transaction(async (tx) => {
      const year = await ensureAcademicYear(tx, schoolId, data.academicYearId);
      const existing = await tx.schoolClass.findUnique({
        where: {
          schoolId_academicYearId_code: {
            schoolId,
            academicYearId: year.id,
            code,
          },
        },
      });
      if (existing) {
        throw new ConflictError(`Class code "${code}" already exists for this academic year`);
      }
      return tx.schoolClass.create({
        data: {
          name: data.name.trim(),
          code,
          schoolId,
          academicYearId: year.id,
        },
      });
    });
  },

  async createSection(
    user: AuthUser,
    paramSchoolId: string,
    classId: string,
    data: { name: string; capacity?: number }
  ) {
    const schoolId = resolveSchoolId(user, paramSchoolId);
    const name = data.name.trim().toUpperCase();

    const cls = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
    });
    if (!cls) throw new NotFoundError("Class");

    const existing = await prisma.section.findUnique({
      where: { classId_name: { classId, name } },
    });
    if (existing) {
      throw new ConflictError(`Section "${name}" already exists in this class`);
    }

    return prisma.section.create({
      data: {
        name,
        classId,
        capacity: data.capacity ?? 40,
      },
    });
  },

  async deleteClass(user: AuthUser, paramSchoolId: string, classId: string) {
    const schoolId = resolveSchoolId(user, paramSchoolId);
    const cls = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId },
      include: {
        _count: { select: { students: true, sections: true } },
      },
    });
    if (!cls) throw new NotFoundError("Class");
    if (cls._count.students > 0) {
      throw new ConflictError(
        "Cannot delete a class that has students admitted. Transfer the students first."
      );
    }
    if (cls._count.sections > 0) {
      throw new ConflictError("Delete the class sections first.");
    }
    await prisma.schoolClass.delete({ where: { id: classId } });
    return { deleted: true };
  },

  async deleteSection(
    user: AuthUser,
    paramSchoolId: string,
    classId: string,
    sectionId: string
  ) {
    const schoolId = resolveSchoolId(user, paramSchoolId);
    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, class: { schoolId } },
      include: { _count: { select: { students: true } } },
    });
    if (!section) throw new NotFoundError("Section");
    if (section._count.students > 0) {
      throw new ConflictError(
        "Cannot delete a section that has students. Transfer the students first."
      );
    }
    await prisma.section.delete({ where: { id: sectionId } });
    return { deleted: true };
  },

  /** Shared seeding used at school-registration time (runs inside the
   *  caller's transaction, no auth involved). */
  async seedForNewSchool(tx: Tx, schoolId: string) {
    const year = await ensureAcademicYear(tx, schoolId);
    for (const { name, code } of DEFAULT_CLASSES) {
      const cls = await tx.schoolClass.upsert({
        where: {
          schoolId_academicYearId_code: {
            schoolId,
            academicYearId: year.id,
            code,
          },
        },
        update: {},
        create: { name, code, schoolId, academicYearId: year.id },
      });
      for (const sectionName of DEFAULT_SECTIONS) {
        await tx.section.upsert({
          where: { classId_name: { classId: cls.id, name: sectionName } },
          update: {},
          create: { name: sectionName, classId: cls.id },
        });
      }
    }
    return year;
  },
};
