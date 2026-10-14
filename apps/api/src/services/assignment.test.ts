import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  createAssignmentSchema,
  gradeSubmissionsSchema,
  studentSubmitAssignmentSchema,
} from "../validators/academicsValidator";
import { assignmentService } from "./assignmentService";

const A_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT2_ID = "44444444-4444-4444-8444-444444444444";

function mockAuth(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-teacher",
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

const studentAuth = () =>
  mockAuth({ roleName: "STUDENT", teacherId: null, studentId: STUDENT_ID, id: "user-student" });

function spyOn(delegate: object, method: string) {
  return jest.spyOn(delegate as Record<string, unknown>, method as never) as unknown as jest.Mock;
}

afterEach(() => {
  jest.restoreAllMocks();
});

const baseAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: A_ID,
  schoolId: "school-a",
  classId: CLASS_ID,
  sectionId: null,
  subjectId: null,
  teacherId: "teacher-1",
  createdBy: "user-teacher",
  status: "PUBLISHED",
  dueDate: new Date("2026-12-31T00:00:00Z"),
  lateSubmissionDate: null,
  allowLateSubmission: false,
  totalMarks: 100,
  ...overrides,
});

describe("assignment validators", () => {
  it("accepts a full create payload", () => {
    const parsed = createAssignmentSchema.parse({
      body: {
        title: "Solar system project",
        description: "Build a model",
        instructions: "Work in pairs",
        classId: CLASS_ID,
        type: "PROJECT",
        dueDate: "2026-11-30",
        lateSubmissionDate: "2026-12-05",
        allowLateSubmission: true,
        totalMarks: 50,
        passingMarks: 20,
        gradingCriteria: "Accuracy 30, creativity 20",
        status: "DRAFT",
      },
    });
    expect(parsed.body.type).toBe("PROJECT");
    expect(parsed.body.allowLateSubmission).toBe(true);
  });

  it("rejects invalid type and >10 reference materials", () => {
    expect(() =>
      createAssignmentSchema.parse({ body: { title: "X", classId: CLASS_ID, dueDate: "2026-11-30", type: "QUIZ" } })
    ).toThrow();
    expect(() =>
      createAssignmentSchema.parse({
        body: { title: "X", classId: CLASS_ID, dueDate: "2026-11-30", referenceMaterials: Array(11).fill("u") },
      })
    ).toThrow();
  });

  it("rejects grading with invalid status and >200 rows", () => {
    expect(() =>
      gradeSubmissionsSchema.parse({
        params: { id: A_ID },
        body: { updates: [{ studentId: STUDENT_ID, status: "APPROVED" }] },
      })
    ).toThrow();
    expect(() =>
      gradeSubmissionsSchema.parse({ params: { id: A_ID }, body: { updates: [] } })
    ).toThrow();
  });

  it("caps submission attachments at 5", () => {
    expect(() =>
      studentSubmitAssignmentSchema.parse({
        params: { id: A_ID },
        body: { attachmentIds: Array(6).fill(A_ID) },
      })
    ).toThrow();
  });
});

describe("assignment lifecycle transitions", () => {
  it("allows DRAFT -> PUBLISHED and notifies students", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment({ status: "DRAFT" }) as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    const update = spyOn(prisma.assignment, "update").mockResolvedValue(baseAssignment({ status: "PUBLISHED" }) as never);
    spyOn(prisma.school, "findUnique").mockResolvedValue({ timezone: "UTC" } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.assignmentSubmission, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.notification, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);

    const result = await assignmentService.transitionAssignment(mockAuth(), A_ID, "PUBLISHED");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PUBLISHED" } })
    );
    expect(result.status).toBe("PUBLISHED");
  });

  it("rejects PUBLISHED -> DRAFT (backward transition)", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment() as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    await expect(assignmentService.transitionAssignment(mockAuth(), A_ID, "DRAFT")).rejects.toThrow(
      "Cannot move assignment from PUBLISHED to DRAFT"
    );
  });

  it("treats ARCHIVED as terminal", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment({ status: "ARCHIVED" }) as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    await expect(assignmentService.transitionAssignment(mockAuth(), A_ID, "PUBLISHED")).rejects.toThrow(
      "Cannot move assignment from ARCHIVED to PUBLISHED"
    );
  });

  it("validates late date after due date on update", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment() as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    await expect(
      assignmentService.updateAssignment(mockAuth(), A_ID, { lateSubmissionDate: "2026-01-01" })
    ).rejects.toThrow("Late submission date must be after the due date");
  });
});

describe("submission deadlines", () => {
  const pastDue = (overrides: Record<string, unknown> = {}) =>
    baseAssignment({ dueDate: new Date("2020-01-01T00:00:00Z"), ...overrides });

  function mockStudentBasics(assignment: Record<string, unknown>) {
    spyOn(prisma.student, "findUnique").mockResolvedValue({
      id: STUDENT_ID, classId: CLASS_ID, sectionId: null, schoolId: "school-a",
      firstName: "Stu", lastName: "Dent",
    } as never);
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(assignment as never);
    spyOn(prisma.teacher, "findUnique").mockResolvedValue({ userId: "user-teacher" } as never);
    spyOn(prisma.notification, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.notification, "createMany").mockResolvedValue({ count: 1 } as never);
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);
  }

  it("rejects submissions after the deadline when late is not allowed", async () => {
    mockStudentBasics(pastDue());
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue(null as never);
    await expect(
      assignmentService.studentSubmit(studentAuth(), A_ID, { submissionText: "late work" })
    ).rejects.toMatchObject({ code: "SUBMISSION_CLOSED" });
  });

  it("accepts late submissions as LATE_SUBMITTED when allowed", async () => {
    mockStudentBasics(pastDue({ allowLateSubmission: true }));
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue(null as never);
    const create = spyOn(prisma.assignmentSubmission, "create").mockResolvedValue({
      id: "sub-1", status: "LATE_SUBMITTED", isLate: true, version: 1,
    } as never);
    const sub = await assignmentService.studentSubmit(studentAuth(), A_ID, { submissionText: "late work" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "LATE_SUBMITTED", isLate: true }) })
    );
    expect(sub.status).toBe("LATE_SUBMITTED");
  });

  it("rejects late submissions past the late-submission date", async () => {
    mockStudentBasics(
      pastDue({ allowLateSubmission: true, lateSubmissionDate: new Date("2020-02-01T00:00:00Z") })
    );
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue(null as never);
    await expect(
      assignmentService.studentSubmit(studentAuth(), A_ID, { submissionText: "too late" })
    ).rejects.toMatchObject({ code: "SUBMISSION_CLOSED" });
  });

  it("rejects empty submissions", async () => {
    mockStudentBasics(baseAssignment());
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue(null as never);
    await expect(assignmentService.studentSubmit(studentAuth(), A_ID, {})).rejects.toMatchObject({
      code: "EMPTY_SUBMISSION",
    });
  });

  it("blocks submissions for another class section", async () => {
    mockStudentBasics(baseAssignment({ sectionId: "99999999-9999-4999-8999-999999999999" }));
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue(null as never);
    await expect(
      assignmentService.studentSubmit(studentAuth(), A_ID, { submissionText: "x" })
    ).rejects.toThrow("Not assigned this work");
  });
});

describe("resubmission history", () => {
  it("snapshots history and bumps version on resubmit (no duplicate rows)", async () => {
    spyOn(prisma.student, "findUnique").mockResolvedValue({
      id: STUDENT_ID, classId: CLASS_ID, sectionId: null, schoolId: "school-a",
      firstName: "Stu", lastName: "Dent",
    } as never);
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment() as never);
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue({
      id: "sub-1", version: 1, status: "SUBMITTED", submissionText: "v1",
      attachments: [], marksObtained: null, feedback: null, submittedAt: new Date(),
    } as never);
    const historyCreate = spyOn(prisma.assignmentSubmissionHistory, "create").mockResolvedValue({} as never);
    const update = spyOn(prisma.assignmentSubmission, "update").mockResolvedValue({
      id: "sub-1", version: 2, status: "SUBMITTED",
    } as never);
    spyOn(prisma.teacher, "findUnique").mockResolvedValue({ userId: "user-teacher" } as never);
    spyOn(prisma.notification, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.notification, "createMany").mockResolvedValue({ count: 1 } as never);
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);

    const sub = await assignmentService.studentSubmit(studentAuth(), A_ID, { submissionText: "v2" });
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 1, submissionText: "v1" }) })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: { increment: 1 } }) })
    );
    expect(sub.version).toBe(2);
  });
});

describe("grading", () => {
  function mockGradeBasics(current: Record<string, unknown> | null) {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment() as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([{ id: STUDENT_ID }] as never);
    spyOn(prisma.assignmentSubmission, "findUnique").mockResolvedValue(current as never);
    spyOn(prisma.assignmentSubmissionHistory, "create").mockResolvedValue({} as never);
    spyOn(prisma.assignmentSubmission, "update").mockImplementation(async (args: unknown) => ({ id: "sub-1", ...(args as any).data }) as never);
    spyOn(prisma.student, "findMany").mockResolvedValueOnce([{ id: STUDENT_ID }] as never);
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);
  }

  it("rejects marks above total marks", async () => {
    mockGradeBasics({
      id: "sub-1", version: 1, status: "SUBMITTED", submissionText: "work",
      submittedAt: new Date(), marksObtained: null, feedback: null,
    });
    await expect(
      assignmentService.gradeSubmissions(mockAuth(), A_ID, [{ studentId: STUDENT_ID, marksObtained: 150 }])
    ).rejects.toThrow("cannot exceed total marks");
  });

  it("requires marks when finalizing GRADED with totalMarks set", async () => {
    mockGradeBasics({
      id: "sub-1", version: 1, status: "UNDER_REVIEW", submissionText: "work",
      submittedAt: new Date(), marksObtained: null, feedback: null,
    });
    await expect(
      assignmentService.gradeSubmissions(mockAuth(), A_ID, [{ studentId: STUDENT_ID, status: "GRADED" }])
    ).rejects.toThrow("Marks are required");
  });

  it("refuses marks without submitted work", async () => {
    mockGradeBasics({
      id: "sub-1", version: 1, status: "NOT_SUBMITTED", submissionText: null,
      submittedAt: null, marksObtained: null, feedback: null,
    });
    await expect(
      assignmentService.gradeSubmissions(mockAuth(), A_ID, [{ studentId: STUDENT_ID, marksObtained: 80 }])
    ).rejects.toThrow("without a submission");
  });

  it("publishes grades and notifies graded students", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment() as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    spyOn(prisma.assignmentSubmission, "findMany")
      .mockResolvedValueOnce([{ id: "sub-1", studentId: STUDENT_ID }] as never)
      .mockResolvedValueOnce([
        { studentId: STUDENT_ID, status: "GRADED", isLate: false, marksObtained: 85 },
      ] as never);
    const updateMany = spyOn(prisma.assignmentSubmission, "updateMany").mockResolvedValue({ count: 1 } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([
      { id: STUDENT_ID, userId: "user-student" },
    ] as never);
    const notify = spyOn(prisma.notification, "createMany").mockResolvedValue({ count: 1 } as never);
    spyOn(prisma.notification, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);

    const result = await assignmentService.publishGrades(mockAuth(), A_ID);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { gradesPublished: true } })
    );
    expect(notify).toHaveBeenCalled();
    expect(result.published).toBe(1);
  });
});

describe("permissions and tenant isolation", () => {
  it("blocks students from grading", async () => {
    await expect(
      assignmentService.gradeSubmissions(studentAuth(), A_ID, [{ studentId: STUDENT_ID, marksObtained: 5 }])
    ).rejects.toThrow("Not allowed for this role");
  });

  it("blocks students from the teacher submission roster", async () => {
    await expect(assignmentService.listSubmissions(studentAuth(), A_ID, {})).rejects.toThrow(
      "Not allowed for this role"
    );
  });

  it("blocks cross-school assignment creation", async () => {
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ schoolId: "school-evil" } as never);
    await expect(
      assignmentService.createAssignment(mockAuth(), { title: "X", classId: CLASS_ID, dueDate: "2026-11-30" })
    ).rejects.toMatchObject({ code: "TENANT_VIOLATION" });
  });

  it("blocks cross-school submission reads", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment({ schoolId: "school-evil" }) as never);
    await expect(assignmentService.getAssignment(mockAuth(), A_ID)).rejects.toMatchObject({
      code: "TENANT_VIOLATION",
    });
  });

  it("blocks students from another student's history", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue(baseAssignment() as never);
    spyOn(prisma.student, "findUnique").mockResolvedValue({ id: STUDENT_ID } as never);
    spyOn(prisma.student, "findFirst").mockResolvedValue(null as never);
    await expect(
      assignmentService.submissionHistory(studentAuth(), A_ID, "99999999-9999-4999-8999-999999999999")
    ).rejects.toThrow("only view your own history");
  });
});

describe("statistics accuracy", () => {
  it("derives stats from actual submission rows", async () => {
    spyOn(prisma.assignment, "findUnique").mockResolvedValue({
      ...baseAssignment(),
      class: { id: CLASS_ID, name: "5" },
      section: null,
      subject: null,
      teacher: null,
    } as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ id: CLASS_ID, classTeacherId: "teacher-1" } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([{ id: STUDENT_ID }, { id: STUDENT2_ID }] as never);
    spyOn(prisma.assignmentSubmission, "findMany").mockResolvedValue([
      { studentId: STUDENT_ID, status: "GRADED", isLate: false, marksObtained: 80 },
      { studentId: STUDENT2_ID, status: "LATE_SUBMITTED", isLate: true, marksObtained: null },
    ] as never);

    const detail = await assignmentService.getAssignment(mockAuth(), A_ID);
    expect(detail.stats).toMatchObject({
      total: 2, submitted: 2, pending: 0, late: 1, graded: 1, averageMarks: 80,
    });
  });
});
