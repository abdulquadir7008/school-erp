import { prisma } from "../config/database";
import { AuthUser } from "../types";
import {
  createExamSchema,
  marksReviewSchema,
  addExamSubjectSchema,
} from "../validators/examValidator";
import { examService } from "./examService";

const EXAM_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const SUBJECT_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_ID = "44444444-4444-4444-8444-444444444444";
const ES_ID = "55555555-5555-4555-8555-555555555555";

function mockAuth(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-admin",
    email: "admin@school.test",
    firstName: "Test",
    lastName: "Admin",
    roleId: "role-1",
    roleName: "SCHOOL_ADMIN",
    schoolId: "school-a",
    branchId: null,
    permissions: ["exam.view", "exam.create", "exam.edit", "exam.publish", "exam.results", "exam.marks"],
    isSuperAdmin: false,
    ...overrides,
  };
}

const teacherAuth = () =>
  mockAuth({
    roleName: "TEACHER",
    id: "user-teacher",
    teacherId: "teacher-1",
    permissions: ["exam.view", "exam.marks", "exam.results"],
  });

function spyOn(delegate: object, method: string) {
  return jest.spyOn(delegate as Record<string, unknown>, method as never) as unknown as jest.Mock;
}

afterEach(() => {
  jest.restoreAllMocks();
});

const baseExam = (overrides: Record<string, unknown> = {}) => ({
  id: EXAM_ID,
  name: "Mid-Term",
  type: "Mid-Term",
  schoolId: "school-a",
  academicYearId: null,
  startDate: new Date("2026-11-01T00:00:00Z"),
  endDate: new Date("2026-11-10T00:00:00Z"),
  status: "DRAFT",
  gradingPolicy: null,
  ...overrides,
});

describe("exam validators", () => {
  it("accepts a full create payload with classes and timetable", () => {
    const parsed = createExamSchema.parse({
      body: {
        name: "First Term Examination",
        type: "Mid-Term",
        startDate: "2026-11-01",
        endDate: "2026-11-10",
        durationMin: 180,
        instructions: "Bring admit card",
        gradingPolicy: { rankEnabled: true, tieMethod: "dense" },
        classes: [{ classId: CLASS_ID }],
        subjects: [
          { subjectId: SUBJECT_ID, maxMarks: 100, passMarks: 40, date: "2026-11-02", startTime: "09:00", endTime: "12:00", room: "Hall A" },
        ],
      },
    });
    expect(parsed.body.classes).toHaveLength(1);
    expect(parsed.body.gradingPolicy?.rankEnabled).toBe(true);
  });

  it("rejects unknown exam types and bad times", () => {
    expect(() =>
      createExamSchema.parse({ body: { name: "X", type: "Surprise Quiz", startDate: "2026-11-01", endDate: "2026-11-02", subjects: [] } })
    ).toThrow();
    expect(() =>
      addExamSubjectSchema.parse({
        params: { id: EXAM_ID },
        body: { subjectId: SUBJECT_ID, maxMarks: 100, passMarks: 40, startTime: "9am", endTime: "12:00" },
      })
    ).toThrow();
  });

  it("rejects empty mark reviews", () => {
    expect(() =>
      marksReviewSchema.parse({ params: { id: EXAM_ID }, body: { examSubjectId: ES_ID } })
    ).toThrow();
  });
});

describe("exam lifecycle transitions", () => {
  it("allows DRAFT -> SCHEDULED and notifies scoped students", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue({ ...baseExam(), classes: [] } as never);
    const update = spyOn(prisma.exam, "update").mockResolvedValue(baseExam({ status: "SCHEDULED" }) as never);
    spyOn(prisma.auditLog, "create").mockResolvedValue({} as never);
    spyOn(prisma.school, "findUnique").mockResolvedValue({ timezone: "UTC" } as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.notification, "findMany").mockResolvedValue([] as never);

    const result = await examService.updateStatus(EXAM_ID, "school-a", "SCHEDULED", false, mockAuth());
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SCHEDULED" }) }));
    expect(result.status).toBe("SCHEDULED");
  });

  it("rejects DRAFT -> PUBLISHED (skipping the workflow)", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(baseExam() as never);
    await expect(examService.updateStatus(EXAM_ID, "school-a", "PUBLISHED", false, mockAuth())).rejects.toThrow(
      "Cannot move exam from DRAFT to PUBLISHED"
    );
  });

  it("treats ARCHIVED as terminal", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(baseExam({ status: "ARCHIVED" }) as never);
    await expect(examService.updateStatus(EXAM_ID, "school-a", "SCHEDULED", false, mockAuth())).rejects.toThrow(
      "Cannot move exam from ARCHIVED to SCHEDULED"
    );
  });

  it("blocks publishing with unapproved marks", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(baseExam({ status: "COMPLETED" }) as never);
    spyOn(prisma.mark, "count").mockResolvedValue(3 as never);
    await expect(examService.updateStatus(EXAM_ID, "school-a", "PUBLISHED", false, mockAuth())).rejects.toThrow(
      "not approved yet"
    );
  });

  it("requires exam.publish permission to publish results", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(baseExam({ status: "COMPLETED" }) as never);
    spyOn(prisma.mark, "count").mockResolvedValue(0 as never);
    await expect(
      examService.updateStatus(EXAM_ID, "school-a", "PUBLISHED", false, teacherAuth())
    ).rejects.toThrow("requires exam.publish permission");
  });
});

describe("timetable conflict detection", () => {
  const examWithScope = () => ({
    ...baseExam(),
    classes: [{ classId: CLASS_ID, sectionId: null }],
  });

  it("rejects overlapping exams for the same class", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(examWithScope() as never);
    spyOn(prisma.examSubject, "findMany").mockResolvedValue([
      {
        id: "other-es", startTime: "10:00", endTime: "13:00", room: "Hall B", invigilatorId: null,
        subject: { name: "Science" },
        exam: { id: "other-exam", name: "Other Exam", classes: [{ classId: CLASS_ID, sectionId: null }] },
      },
    ] as never);
    const conflicts = await examService.detectTimetableConflicts(EXAM_ID, {
      date: "2026-11-02", startTime: "09:00", endTime: "12:00",
    });
    expect(conflicts.some((c) => c.type === "CLASS_OVERLAP")).toBe(true);
  });

  it("rejects double-booked rooms and invigilators", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue({
      ...baseExam(), classes: [{ classId: "99999999-9999-4999-8999-999999999999", sectionId: null }],
    } as never);
    spyOn(prisma.examSubject, "findMany").mockResolvedValue([
      {
        id: "other-es", startTime: "10:00", endTime: "13:00", room: "Hall A", invigilatorId: "teacher-9",
        subject: { name: "Science" },
        exam: { id: "other-exam", name: "Other Exam", classes: [{ classId: "99999999-9999-4999-8999-999999999999", sectionId: null }] },
      },
    ] as never);
    const conflicts = await examService.detectTimetableConflicts(EXAM_ID, {
      date: "2026-11-02", startTime: "09:00", endTime: "12:00", room: "Hall A", invigilatorId: "teacher-9",
    });
    // Same-class rows also overlap here; room + invigilator must both flag.
    expect(conflicts.some((c) => c.type === "ROOM_OVERLAP")).toBe(true);
    expect(conflicts.some((c) => c.type === "INVIGILATOR_OVERLAP")).toBe(true);
  });

  it("allows non-overlapping entries", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(examWithScope() as never);
    spyOn(prisma.examSubject, "findMany").mockResolvedValue([
      {
        id: "other-es", startTime: "14:00", endTime: "17:00", room: "Hall A", invigilatorId: null,
        subject: { name: "Science" },
        exam: { id: "other-exam", name: "Other Exam", classes: [{ classId: CLASS_ID, sectionId: null }] },
      },
    ] as never);
    const conflicts = await examService.detectTimetableConflicts(EXAM_ID, {
      date: "2026-11-02", startTime: "09:00", endTime: "12:00", room: "Hall A",
    });
    expect(conflicts).toHaveLength(0);
  });

  it("rejects end time before start time", async () => {
    const conflicts = await examService.detectTimetableConflicts(EXAM_ID, {
      date: "2026-11-02", startTime: "12:00", endTime: "09:00",
    });
    expect(conflicts[0].type).toBe("INVALID_TIME");
  });
});

describe("marks entry validation", () => {
  function mockEnterBasics(examOverrides: Record<string, unknown> = {}) {
    spyOn(prisma.exam, "findUnique").mockResolvedValue({
      ...baseExam(examOverrides),
      subjects: [{ id: ES_ID, maxMarks: 100, passMarks: 40 }],
    } as never);
    spyOn(prisma.timetable, "findMany").mockResolvedValue([{ classId: CLASS_ID }] as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([
      { id: STUDENT_ID, schoolId: "school-a", classId: CLASS_ID },
    ] as never);
    spyOn(prisma.mark, "findMany").mockResolvedValue([] as never);
    spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
      const tx = {
        mark: {
          findUnique: async () => null,
          create: async (args: any) => ({ id: "mark-1", ...args.data }),
          update: async (args: any) => ({ id: "mark-1", ...args.data }),
        },
        markHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };
      return (cb as any)(tx);
    });
  }

  it("rejects marks above maximum", async () => {
    mockEnterBasics();
    await expect(
      examService.enterMarks(EXAM_ID, teacherAuth(), {
        examSubjectId: ES_ID,
        marks: [{ studentId: STUDENT_ID, marksObtained: 120 }],
      })
    ).rejects.toThrow("between 0 and 100");
  });

  it("rejects absent + exempt together", async () => {
    mockEnterBasics();
    await expect(
      examService.enterMarks(EXAM_ID, teacherAuth(), {
        examSubjectId: ES_ID,
        marks: [{ studentId: STUDENT_ID, marksObtained: null, isAbsent: true, isExempt: true }],
      })
    ).rejects.toThrow("both absent and exempted");
  });

  it("locks published exams for teachers without publish rights", async () => {
    mockEnterBasics({ status: "PUBLISHED" });
    await expect(
      examService.enterMarks(EXAM_ID, teacherAuth(), {
        examSubjectId: ES_ID,
        marks: [{ studentId: STUDENT_ID, marksObtained: 80 }],
      })
    ).rejects.toThrow("already published");
  });

  it("allows audited corrections after publish with exam.publish", async () => {
    mockEnterBasics({ status: "PUBLISHED" });
    spyOn(prisma.timetable, "findMany").mockResolvedValue([{ classId: CLASS_ID }] as never);
    const result = await examService.enterMarks(EXAM_ID, mockAuth(), {
      examSubjectId: ES_ID,
      marks: [{ studentId: STUDENT_ID, marksObtained: 85 }],
    });
    expect(result.updated).toBe(1);
  });

  it("blocks teachers from other classes", async () => {
    mockEnterBasics();
    spyOn(prisma.timetable, "findMany").mockResolvedValue([{ classId: "other-class" }] as never);
    spyOn(prisma.student, "findMany").mockResolvedValue([{ id: STUDENT_ID, classId: CLASS_ID }] as never);
    await expect(
      examService.enterMarks(EXAM_ID, teacherAuth(), {
        examSubjectId: ES_ID,
        marks: [{ studentId: STUDENT_ID, marksObtained: 70 }],
      })
    ).rejects.toThrow("Not assigned to this student's class");
  });
});

describe("marks review workflow", () => {
  const esWithExam = () => ({
    id: ES_ID,
    examId: EXAM_ID,
    subjectId: SUBJECT_ID,
    exam: { id: EXAM_ID, schoolId: "school-a", status: "COMPLETED", classes: [] },
    subject: { id: SUBJECT_ID, name: "Math" },
  });

  it("submits drafts for review", async () => {
    spyOn(prisma.examSubject, "findUnique").mockResolvedValue({ ...esWithExam(), exam: { ...esWithExam().exam, classes: [] } } as never);
    spyOn(prisma.timetable, "findMany").mockResolvedValue([{ subjectId: SUBJECT_ID, classId: CLASS_ID }] as never);
    spyOn(prisma.schoolClass, "findMany").mockResolvedValue([] as never);
    spyOn(prisma.mark, "findMany").mockResolvedValue([{ id: "mark-1" }] as never);
    spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
      const tx = {
        mark: { updateMany: async () => ({ count: 1 }), findUnique: async () => ({ studentId: STUDENT_ID }) },
        markHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };
      return (cb as any)(tx);
    });
    const result = await examService.submitMarks(EXAM_ID, teacherAuth(), ES_ID);
    expect(result.submitted).toBe(1);
  });

  it("approves and rejects with notes (exam.edit required)", async () => {
    spyOn(prisma.examSubject, "findUnique").mockResolvedValue({ ...esWithExam(), exam: { ...esWithExam().exam, classes: [] } } as never);
    spyOn(prisma, "$transaction").mockImplementation(async (cb: unknown) => {
      const tx = {
        mark: {
          findMany: async () => [{ id: "mark-1", marksObtained: 80, studentId: STUDENT_ID }],
          findFirst: async () => ({ id: "mark-2", marksObtained: 30, studentId: "66666666-6666-4666-8666-666666666666" }),
          update: async (args: any) => ({ ...args.data }),
        },
        markHistory: { create: async () => ({}) },
        auditLog: { create: async () => ({}) },
      };
      return (cb as any)(tx);
    });
    const result = await examService.reviewMarks(EXAM_ID, mockAuth(), ES_ID, {
      approved: [STUDENT_ID],
      rejected: [{ studentId: "66666666-6666-4666-8666-666666666666", note: "Recheck Q3" }],
    });
    expect(result).toMatchObject({ approved: 1, rejected: 1 });
  });

  it("blocks teachers from approving (no exam.edit)", async () => {
    spyOn(prisma.examSubject, "findUnique").mockResolvedValue({ ...esWithExam(), exam: { ...esWithExam().exam, classes: [] } } as never);
    await expect(
      examService.reviewMarks(EXAM_ID, teacherAuth(), ES_ID, { approved: [STUDENT_ID] })
    ).rejects.toThrow("requires exam.edit permission");
  });
});

describe("grading, ranks, and report cards", () => {
  it("applies custom boundaries, dense ranks, and excludes exempt subjects", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue({
      ...baseExam({ status: "PUBLISHED", gradingPolicy: { boundaries: { A: 70, B: 50 }, rankEnabled: true, tieMethod: "dense" } }),
      subjects: [
        {
          maxMarks: 100, passMarks: 40, subject: { name: "Math" },
          marks: [
            { student: { id: STUDENT_ID, firstName: "A", lastName: "S", admissionNumber: "1" }, marksObtained: 80, remarks: null, isAbsent: false, isExempt: false },
            { student: { id: "66666666-6666-4666-8666-666666666666", firstName: "B", lastName: "S", admissionNumber: "2" }, marksObtained: 80, remarks: null, isAbsent: false, isExempt: false },
            { student: { id: "77777777-7777-4777-8777-777777777777", firstName: "C", lastName: "S", admissionNumber: "3" }, marksObtained: null, remarks: null, isAbsent: false, isExempt: true },
          ],
        },
      ],
    } as never);
    spyOn(prisma.attendance, "findMany").mockResolvedValue([] as never);
    const res = await examService.getResults(EXAM_ID, "school-a", true);
    const byId = new Map(res.students.map((s: any) => [s.id, s]));
    expect(byId.get(STUDENT_ID)).toMatchObject({ grade: "A", rank: 1, percentage: 80 });
    // Tie shares rank 1 under dense ranking.
    expect(byId.get("66666666-6666-4666-8666-666666666666")).toMatchObject({ rank: 1 });
    // Exempt student: no max, stays passed with no grade penalty.
    expect(byId.get("77777777-7777-4777-8777-777777777777")).toMatchObject({ totalMax: 0, passed: true });
  });

  it("keeps unpublished results hidden from students", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue({
      ...baseExam({ status: "COMPLETED" }),
      subjects: [],
    } as never);
    await expect(
      examService.getResults(EXAM_ID, "school-a", false, mockAuth({ roleName: "STUDENT" }))
    ).rejects.toThrow("not published yet");
  });

  it("lets students see only their own published report card", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue({
      ...baseExam({ status: "PUBLISHED" }),
      subjects: [],
      classes: [],
    } as never);
    // getReportCard fetches the target student first, then resolveStudentId
    // looks the viewer up by their own id.
    spyOn(prisma.student, "findUnique")
      .mockResolvedValueOnce({
        id: "other-student", schoolId: "school-a", classId: CLASS_ID, sectionId: null,
      } as never)
      .mockResolvedValue({ id: STUDENT_ID } as never);
    await expect(
      examService.getReportCard(
        EXAM_ID,
        "other-student",
        mockAuth({ roleName: "STUDENT", studentId: STUDENT_ID })
      )
    ).rejects.toThrow("only view your own report card");
  });
});

describe("exam tenant isolation", () => {
  it("blocks cross-school reads", async () => {
    spyOn(prisma.exam, "findUnique").mockResolvedValue(baseExam({ schoolId: "school-evil" }) as never);
    await expect(examService.getById(EXAM_ID, "school-a", false)).rejects.toMatchObject({
      code: "TENANT_VIOLATION",
    });
  });

  it("blocks cross-school exam creation scope", async () => {
    spyOn(prisma.exam, "findFirst").mockResolvedValue(null as never);
    spyOn(prisma.schoolClass, "findUnique").mockResolvedValue({ schoolId: "school-evil" } as never);
    await expect(
      examService.create({
        name: "X", type: "Mid-Term", startDate: "2026-11-01", endDate: "2026-11-02",
        schoolId: "school-a", classes: [{ classId: CLASS_ID }], subjects: [],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
