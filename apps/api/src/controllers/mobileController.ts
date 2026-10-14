import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { mobileService } from "../services/mobileService";

export const mobileController = {
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = req.user!.roleName;
      const data =
        role === "TEACHER"
          ? await mobileService.teacherMe(req.user!)
          : await mobileService.studentMe(req.user!);
      res.json({ success: true, data, message: "Profile retrieved" });
    } catch (e) { next(e); }
  },

  async studentDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentDashboard(req.user!);
      res.json({ success: true, data, message: "Student dashboard" });
    } catch (e) { next(e); }
  },

  async timetable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data =
        req.user!.roleName === "TEACHER"
          ? await mobileService.teacherTimetable(req.user!)
          : await mobileService.studentTimetable(req.user!);
      res.json({ success: true, data, message: "Timetable retrieved" });
    } catch (e) { next(e); }
  },

  async attendance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const month = req.query.month ? Number(req.query.month) : undefined;
      const year = req.query.year ? Number(req.query.year) : undefined;
      const data = await mobileService.studentAttendance(req.user!, { month, year });
      res.json({ success: true, data, message: "Attendance retrieved" });
    } catch (e) { next(e); }
  },

  async homework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentHomework(req.user!);
      res.json({ success: true, data, message: "Homework retrieved" });
    } catch (e) { next(e); }
  },

  async submitHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const data = await mobileService.studentSubmitHomework(req.user!, id, req.body ?? {});
      res.json({ success: true, data, message: "Homework submitted" });
    } catch (e) { next(e); }
  },

  async teacherHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.teacherHomework(req.user!);
      res.json({ success: true, data, message: "Homework retrieved" });
    } catch (e) { next(e); }
  },

  async studentAssignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentAssignments(req.user!);
      res.json({ success: true, data, message: "Assignments retrieved" });
    } catch (e) { next(e); }
  },

  async submitAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const { assignmentService } = await import("../services/assignmentService");
      const data = await assignmentService.studentSubmit(req.user!, id, req.body ?? {});
      res.json({ success: true, data, message: "Assignment submitted" });
    } catch (e) { next(e); }
  },

  async teacherAssignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { assignmentService } = await import("../services/assignmentService");
      const data = await assignmentService.listAssignments(req.user!, {});
      res.json({ success: true, data, message: "Assignments retrieved" });
    } catch (e) { next(e); }
  },

  async teacherSubmissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const { assignmentService } = await import("../services/assignmentService");
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const data = await assignmentService.listSubmissions(req.user!, id, { status, search });
      res.json({ success: true, data, message: "Submissions retrieved" });
    } catch (e) { next(e); }
  },

  async teacherGrade(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const { assignmentService } = await import("../services/assignmentService");
      const data = await assignmentService.gradeSubmissions(req.user!, id, req.body.updates);
      res.json({ success: true, data, message: "Grading saved" });
    } catch (e) { next(e); }
  },

  async teacherPublishGrades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const { assignmentService } = await import("../services/assignmentService");
      const data = await assignmentService.publishGrades(
        req.user!,
        id,
        Array.isArray(req.body?.studentIds) ? req.body.studentIds : undefined
      );
      res.json({ success: true, data, message: "Grades published" });
    } catch (e) { next(e); }
  },

  async uploadAssignmentFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const file = (req as any).file as
        | { buffer: Buffer; originalname: string; mimetype: string; size: number }
        | undefined;
      if (!file?.buffer?.length) {
        res.status(400).json({ success: false, message: "No file received", code: "NO_FILE" });
        return;
      }
      const { assignmentService } = await import("../services/assignmentService");
      const data = await assignmentService.uploadAttachment(req.user!, {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });
      res.status(201).json({
        success: true,
        data: { id: data.id, name: data.name, mimeType: data.type, size: data.size },
        message: "File uploaded",
      });
    } catch (e) { next(e); }
  },

  async downloadAssignmentFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const docId = typeof req.params.docId === "string" ? req.params.docId : "";
      const { assignmentService } = await import("../services/assignmentService");
      const resolved = await assignmentService.authorizeAttachment(req.user!, docId);
      if (resolved.kind === "redirect") {
        res.redirect(302, resolved.signedUrl);
        return;
      }
      res.setHeader("Content-Type", resolved.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${resolved.fileName.replace(/"/g, "")}"`);
      res.sendFile(resolved.absPath);
    } catch (e) { next(e); }
  },

  async exams(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
      const data =
        req.user!.roleName === "TEACHER"
          ? await mobileService.teacherExams(req.user!)
          : await mobileService.studentExams(req.user!, studentId);
      res.json({ success: true, data, message: "Examinations retrieved" });
    } catch (e) { next(e); }
  },

  async results(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
      const data = await mobileService.studentResults(req.user!, studentId);
      res.json({ success: true, data, message: "Published results retrieved" });
    } catch (e) { next(e); }
  },

  async reportCard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
      const format = req.query.format === "pdf" ? "pdf" : "json";
      const { examService } = await import("../services/examService");
      const { resolveStudentId } = await import("../services/academicsService");
      const targetStudentId =
        req.user!.roleName === "STUDENT"
          ? await resolveStudentId(req.user!)
          : studentId;
      if (!targetStudentId) {
        res.status(400).json({ success: false, message: "studentId is required", code: "VALIDATION_ERROR" });
        return;
      }
      const report = await examService.getReportCard(id, targetStudentId, req.user!);
      if (format === "pdf") {
        const { pdfService } = await import("../services/pdfService");
        const school = await examService.getReportSchool(report);
        const buffer = await pdfService.generateReportCardPdf({ ...report, school } as any);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="report-card-${report.student.admissionNumber}.pdf"`
        );
        res.send(buffer);
        return;
      }
      res.json({ success: true, data: report, message: "Report card retrieved" });
    } catch (e) { next(e); }
  },

  async teacherMarksRoster(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const examSubjectId = typeof req.query.examSubjectId === "string" ? req.query.examSubjectId : "";
      const { examService } = await import("../services/examService");
      const data = await examService.getMarksRoster(id, examSubjectId, req.user!);
      res.json({ success: true, data, message: "Marks roster retrieved" });
    } catch (e) { next(e); }
  },

  async teacherSubmitMarks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = typeof req.params.id === "string" ? req.params.id : "";
      const { examService } = await import("../services/examService");
      const data = await examService.submitMarks(
        id,
        req.user!,
        req.body.examSubjectId,
        Array.isArray(req.body?.studentIds) ? req.body.studentIds : undefined
      );
      res.json({ success: true, data, message: "Marks submitted for review" });
    } catch (e) { next(e); }
  },

  async fees(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentFees(req.user!);
      res.json({ success: true, data, message: "Fee details retrieved" });
    } catch (e) { next(e); }
  },

  async library(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentLibrary(req.user!);
      res.json({ success: true, data, message: "Library details retrieved" });
    } catch (e) { next(e); }
  },

  async transport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentTransport(req.user!);
      res.json({ success: true, data, message: "Transport details retrieved" });
    } catch (e) { next(e); }
  },

  async teacherDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.teacherDashboard(req.user!);
      res.json({ success: true, data, message: "Teacher dashboard" });
    } catch (e) { next(e); }
  },

  async teacherClasses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.teacherClasses(req.user!);
      res.json({ success: true, data, message: "Assigned classes retrieved" });
    } catch (e) { next(e); }
  },

  async teacherStudents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
      const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
      const data = await mobileService.teacherStudents(req.user!, classId, sectionId);
      res.json({ success: true, data, message: "Students retrieved" });
    } catch (e) { next(e); }
  },

  async notifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.notifications(req.user!);
      res.json({ success: true, data, message: "Notifications retrieved" });
    } catch (e) { next(e); }
  },

  async announcements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.announcements(req.user!);
      res.json({ success: true, data, message: "Announcements retrieved" });
    } catch (e) { next(e); }
  },
};
