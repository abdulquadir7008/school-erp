import bcrypt from "bcryptjs";
import { prisma } from "../config/database";
import {
  ConflictError,
  NotFoundError,
  TenantError,
} from "../utils/errors";

interface CreateStudentData {
  admissionNumber: string;
  studentId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  bloodGroup?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  classId: string;
  sectionId?: string;
  rollNumber?: number;
  branchId?: string;
  schoolId: string;
  guardians?: {
    firstName: string;
    lastName: string;
    relation: string;
    phone: string;
    email?: string;
  }[];
  parentUserId?: string;
}

export const studentService = {
  async create(data: CreateStudentData) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.student.findUnique({
        where: {
          schoolId_admissionNumber: {
            schoolId: data.schoolId,
            admissionNumber: data.admissionNumber.toUpperCase(),
          },
        },
      });

      if (existing) {
        throw new ConflictError("Admission number already in use");
      }

      const student = await tx.student.create({
        data: {
          admissionNumber: data.admissionNumber.toUpperCase(),
          studentId: data.studentId,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          classId: data.classId,
          sectionId: data.sectionId,
          rollNumber: data.rollNumber,
          branchId: data.branchId,
          schoolId: data.schoolId,
        },
      });

      if (data.guardians?.length) {
        for (const guardian of data.guardians) {
          const parent = await tx.parent.create({
            data: {
              firstName: guardian.firstName,
              lastName: guardian.lastName,
              phone: guardian.phone,
              email: guardian.email,
              schoolId: data.schoolId,
            },
          });

          await tx.studentParent.create({
            data: {
              studentId: student.id,
              parentId: parent.id,
              relation: guardian.relation,
            },
          });

          if (guardian.email) {
            const existingUser = await tx.user.findFirst({
              where: { email: guardian.email, schoolId: data.schoolId },
            });

            if (!existingUser) {
              const parentRole = await tx.role.findUnique({
                where: { name: "PARENT" },
              });

              if (parentRole) {
                await tx.user.create({
                  data: {
                    email: guardian.email.toLowerCase(),
                    passwordHash: await bcrypt.hash("School@2024", 10),
                    firstName: guardian.firstName,
                    lastName: guardian.lastName,
                    roleId: parentRole.id,
                    schoolId: data.schoolId,
                    branchId: data.branchId,
                  },
                });
              }
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "STUDENT",
          entityId: student.id,
          schoolId: data.schoolId,
          newValue: { admissionNumber: student.admissionNumber },
        },
      });

      return student;
    });
  },

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    schoolId?: string;
    isSuperAdmin?: boolean;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 25));

    if (!query.schoolId && !query.isSuperAdmin) {
      throw new TenantError("School context required");
    }

    const where: any = {};
    if (query.schoolId) {
      where.schoolId = query.schoolId;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { admissionNumber: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.classId) where.classId = query.classId;
    if (query.sectionId) where.sectionId = query.sectionId;
    if (query.status) where.status = query.status;

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { admissionDate: "desc" },
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
          parents: {
            include: {
              parent: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: { include: { academicYear: true } },
        section: true,
        school: { select: { id: true, name: true } },
        parents: { include: { parent: true } },
        attendances: { orderBy: { date: "desc" }, take: 30 },
        invoices: { include: { payments: true } },
      },
    });

    if (!student) {
      throw new NotFoundError("Student");
    }

    if (!isSuperAdmin && student.schoolId !== schoolId) {
      throw new TenantError("Cannot access this student's data");
    }

    return student;
  },

  async update(id: string, schoolId: string | undefined, data: Partial<CreateStudentData>, isSuperAdmin = false) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundError("Student");
    }
    if (!isSuperAdmin && student.schoolId !== schoolId) {
      throw new TenantError();
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          gender: data.gender,
          bloodGroup: data.bloodGroup,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          state: data.state,
          classId: data.classId,
          sectionId: data.sectionId,
          rollNumber: data.rollNumber,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "STUDENT",
          entityId: student.id,
          schoolId: schoolId || student.schoolId,
          oldValue: { firstName: student.firstName, classId: student.classId },
          newValue: { firstName: data.firstName, classId: data.classId },
        },
      });

      return updated;
    });
  },

  async delete(id: string, schoolId: string | undefined, isSuperAdmin = false) {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      throw new NotFoundError("Student");
    }
    if (!isSuperAdmin && student.schoolId !== schoolId) {
      throw new TenantError();
    }

    await prisma.student.update({
      where: { id },
      data: { status: "TRANSFERRED" },
    });

    return { success: true };
  },

  async getDashboardStats(schoolId: string | undefined, isSuperAdmin = false) {
    if (!schoolId && !isSuperAdmin) {
      throw new TenantError("School context required");
    }
    const scope = schoolId ? { schoolId } : {};
    const [total, male, female, active] = await Promise.all([
      prisma.student.count({ where: scope }),
      prisma.student.count({ where: { ...scope, gender: "MALE" } }),
      prisma.student.count({ where: { ...scope, gender: "FEMALE" } }),
      prisma.student.count({ where: { ...scope, status: "ACTIVE" } }),
    ]);

    return { total, male, female, active };
  },
};