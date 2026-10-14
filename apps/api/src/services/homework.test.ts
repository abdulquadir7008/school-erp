import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  createHomeworkSchema,
  updateCompletionsSchema,
  studentSubmitHomeworkSchema,
} from "../validators/academicsValidator";
import { academicsService } from "./academicsService";
import { mobileService } from "./mobileService";

const HW_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const A_ID = "77777777-7777-4777-8777-777777777777";

function mockAuth(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: "teacher@school.test",
    firstName: "Test",
    lastName: "Teacher",
    roleId: "role-1",
    roleName: "TEACHER",
    schoolId: "school-a",
    branchId: null,
    permissions: ["homework.view", "homework.create"],
    isSuperAdmin: false,
    teacherId: "teacher-1",
    ...overrides,
  };
}

function spyOn(delegate: object, method: string) {
  return jest.spyOn(delegate as Record<string, unknown>, method as never) as unknown as jest.Mock;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("homework validators", () => {
  it("accepts a full create payload (section, subject, priority, attachments, status)", () => {
    const parsed = createHomeworkSchema.parse({
      body: {
        title: "Chapter 5 exercises",
        description: "Solve Q1-Q10",
        classId: CLASS_ID,
        sectionId: HW_ID,
        subjectId: HW_ID,
        homeworkDate: "2026-10-10",
        dueDate: "2026-10-20",
        priority: "HIGH",
        status: "DRAFT",
        attachments: ["https://files.test/worksheet.pdf"],
      },
    });
    expect(parsed.body.priority).toBe("HIGH");
    expect(parsed.body.attachments).toHaveLength(1);
  });

  it("rejects missing title and invalid priority", () => {
    expect(() =>
      createHomeworkSchema.parse({ body: { title: "", classId: CLASS_ID, dueDate: "2026-10-20" } })
    ).toThrow();
    expect(() =>
      createHomeworkSchema.parse({
        body: { title: "HW", classId: CLASS_ID, dueDate: "2026-10-20", priority: "EXTREME" },
      })
    ).toThrow();
  });

  it("rejects completion updates with invalid status or empty list", () => {
    expect(() =>
      updateCompletionsSchema.parse({
        params: { id: HW_ID },
        body: { updates: [{ studentId: STUDENT_ID, status: "DONE" }] },
      })
    ).toThrow();
    expect(() =>
      updateCompletionsSchema.parse({ params: { id: HW_ID }, body: { updates: [] } })
    ).toThrow();
  });

  it("accepts an empty student submit body", () => {
    const parsed = studentSubmitHomeworkSchema.parse({ params: { id: HW_ID }, body: {} });
    expect(parsed.params.id).toBe(HW_ID);
  });
});

describe("academicsService tenant isolation", () => {
  it("blocks homework creation for a class from another school", async () => {
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ schoolId: "school-b" } as never);
    await expect(
      academicsService.createHomework(mockAuth(), {
        title: "HW",
        classId: CLASS_ID,
        dueDate: "2026-10-20",
      })
    ).rejects.toMatchObject({ code: "TENANT_VIOLATION" });
  });

  it("blocks completion updates for homework from another school", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue({
      id: HW_ID,
      schoolId: "school-b",
      classId: CLASS_ID,
      sectionId: null,
    } as never);
    await expect(
      academicsService.updateCompletions(mockAuth(), HW_ID, [
        { studentId: STUDENT_ID, status: "COMPLETED" },
      ])
    ).rejects.toMatchObject({ code: "TENANT_VIOLATION" });
  });

  it("blocks cross-school homework detail reads", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue({
      id: HW_ID,
      schoolId: "school-evil",
      classId: CLASS_ID,
      subjectId: null,
      dueDate: new Date(),
    } as never);
    await expect(academicsService.getHomework(mockAuth(), HW_ID)).rejects.toMatchObject({
      code: "TENANT_VIOLATION",
    });
  });
});

describe("academicsService completion tracking", () => {
  const hw = {
    id: HW_ID,
    schoolId: "school-a",
    classId: CLASS_ID,
    sectionId: null,
    subjectId: null,
    dueDate: new Date("2026-12-31"),
  };

  it("rejects invalid status transitions before writing", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue(hw as never);
    const upsert = spyOn(prisma.homeworkSubmission, "upsert");
    await expect(
      academicsService.updateCompletions(mockAuth(), HW_ID, [
        { studentId: STUDENT_ID, status: "DONE" },
      ])
    ).rejects.toThrow("Invalid status");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts per-student rows (no duplicates) and returns fresh stats", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue(hw as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({
      id: CLASS_ID,
      classTeacherId: "teacher-1",
    } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([
      { id: STUDENT_ID },
      { id: "44444444-4444-4444-8444-444444444444" },
    ] as never);
    const upsert = spyOn(prisma.homeworkSubmission, "upsert").mockImplementation(
      async (args: unknown) => ({ id: "sub-1", ...(args as object) }) as never
    );
    spyOn(prisma, "$transaction").mockImplementation(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : ops as never
    );
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);
    spyOn(prisma.homeworkSubmission, "findMany").mockResolvedValue([
      { studentId: STUDENT_ID, status: "COMPLETED" },
      { studentId: "44444444-4444-4444-8444-444444444444", status: "NOT_SUBMITTED" },
    ] as never);

    const result = await academicsService.updateCompletions(mockAuth(), HW_ID, [
      { studentId: STUDENT_ID, status: "COMPLETED", teacherRemark: "Well done" },
      { studentId: "44444444-4444-4444-8444-444444444444", status: "NOT_SUBMITTED" },
    ]);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(result.updated).toBe(2);
    expect(result.stats).toMatchObject({ total: 2, completed: 1, notSubmitted: 1 });
  });

  it("rejects completion updates for students outside the homework scope", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue(hw as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({
      id: CLASS_ID,
      classTeacherId: "teacher-1",
    } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([] as never);
    await expect(
      academicsService.updateCompletions(mockAuth(), HW_ID, [
        { studentId: STUDENT_ID, status: "COMPLETED" },
      ])
    ).rejects.toThrow("not in this homework scope");
  });
});

describe("student submission scoping", () => {
  it("blocks students from submitting another class homework", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue({
      id: HW_ID,
      schoolId: "school-a",
      classId: CLASS_ID,
      sectionId: null,
      status: "PUBLISHED",
    } as never);
    spyOn(prisma.student, "findUnique").mockResolvedValue({
      id: STUDENT_ID,
      classId: "99999999-9999-4999-8999-999999999999",
      sectionId: null,
      schoolId: "school-a",
    } as never);
    spyOn(prisma.student, "findFirst").mockResolvedValue(null as never);
    await expect(
      academicsService.studentSubmit(
        mockAuth({ roleName: "STUDENT", teacherId: null, studentId: STUDENT_ID }),
        HW_ID,
        {}
      )
    ).rejects.toThrow("Not assigned this homework");
  });

  it("lets a student submit their own homework exactly once (upsert)", async () => {
    spyOn(prisma.homework, "findUnique").mockResolvedValue({
      id: HW_ID,
      schoolId: "school-a",
      classId: CLASS_ID,
      sectionId: null,
      status: "PUBLISHED",
    } as never);
    spyOn(prisma.student, "findUnique").mockResolvedValue({
      id: STUDENT_ID,
      classId: CLASS_ID,
      sectionId: null,
      schoolId: "school-a",
    } as never);
    const upsert = spyOn(prisma.homeworkSubmission, "upsert").mockResolvedValue({
      status: "COMPLETED",
    } as never);
    const sub = await academicsService.studentSubmit(
      mockAuth({ roleName: "STUDENT", teacherId: null, studentId: STUDENT_ID }),
      HW_ID,
      { submissionText: "Done" }
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(sub.status).toBe("COMPLETED");
  });
});

describe("mobileService student homework", () => {
  it("scopes homework to the student's class/section/school and enriches status", async () => {
    spyOn(prisma.student, "findUnique").mockResolvedValue({
      id: STUDENT_ID,
      classId: CLASS_ID,
      sectionId: null,
      schoolId: "school-a",
      class: { id: CLASS_ID, name: "5" },
      section: null,
      school: { id: "school-a", name: "Test", schoolCode: "T1" },
    } as never);
    const findMany = spyOn(prisma.homework, "findMany").mockResolvedValue([
      { id: HW_ID, dueDate: new Date("2026-12-31"), title: "HW1" },
    ] as never);
    spyOn(prisma.homeworkSubmission, "findMany").mockResolvedValue([
      { homeworkId: HW_ID, status: "COMPLETED" },
    ] as never);
    spyOn(prisma.assignment, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.assignmentSubmission, "findMany").mockResolvedValue([] as never);

    const data = await mobileService.studentHomework(
      mockAuth({ roleName: "STUDENT", teacherId: null, studentId: STUDENT_ID })
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ classId: CLASS_ID, schoolId: "school-a", status: "PUBLISHED" }),
      })
    );
    expect(data.homework[0]).toMatchObject({ myStatus: "COMPLETED", completionStatus: "COMPLETED" });
  });
});

describe("mobileService student dashboard pending lists", () => {
  const dashboardStudent = {
    id: STUDENT_ID,
    firstName: "Stu",
    lastName: "Dent",
    admissionNumber: "A1",
    photo: null,
    classId: CLASS_ID,
    sectionId: null,
    schoolId: "school-a",
    class: { id: CLASS_ID, name: "5" },
    section: null,
    school: { id: "school-a", name: "Test", schoolCode: "T1" },
  };

  function mockDashboardBasics() {
    spyOn(prisma.student, "findUnique").mockResolvedValue(dashboardStudent as never);
    spyOn(prisma.timetable, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.attendance, "findFirst").mockResolvedValue(null as never);
    spyOn(prisma.attendance, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.exam, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.announcement, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.invoice, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.mark, "findMany").mockResolvedValue([] as never);
  }

  it("excludes completed homework from pendingHomework", async () => {
    mockDashboardBasics();
    spyOn(prisma.homework, "findMany").mockResolvedValue([
      { id: HW_ID, title: "Done HW", dueDate: new Date("2026-12-31") },
      { id: "55555555-5555-4555-8555-555555555555", title: "Todo HW", dueDate: new Date("2026-12-31") },
    ] as never);
    spyOn(prisma.homeworkSubmission, "findMany").mockResolvedValue([
      { homeworkId: HW_ID, status: "COMPLETED" },
    ] as never);
    spyOn(prisma.assignment, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.assignmentSubmission, "findMany").mockResolvedValue([] as never);

    const data = await mobileService.studentDashboard(
      mockAuth({ roleName: "STUDENT", teacherId: null, studentId: STUDENT_ID })
    );
    expect(data.pendingHomework.map((h: any) => h.title)).toEqual(["Todo HW"]);
  });

  it("excludes graded assignments from pendingAssignments", async () => {
    mockDashboardBasics();
    spyOn(prisma.homework, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.homeworkSubmission, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.assignment, "findMany").mockResolvedValue([
      { id: A_ID, title: "Graded A", dueDate: new Date("2026-12-31") },
      { id: "66666666-6666-4666-8666-666666666666", title: "Todo A", dueDate: new Date("2026-12-31") },
    ] as never);
    spyOn(prisma.assignmentSubmission, "findMany").mockResolvedValue([
      { assignmentId: A_ID, status: "GRADED" },
    ] as never);

    const data = await mobileService.studentDashboard(
      mockAuth({ roleName: "STUDENT", teacherId: null, studentId: STUDENT_ID })
    );
    expect(data.pendingAssignments.map((a: any) => a.title)).toEqual(["Todo A"]);
  });
});
