import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { assignmentService } from "../services/assignmentService";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export const assignmentController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.listAssignments(req.user!, {
        classId: str(req.query.classId),
        sectionId: str(req.query.sectionId),
        subjectId: str(req.query.subjectId),
        type: str(req.query.type),
        status: str(req.query.status),
        search: str(req.query.search),
        overdue: str(req.query.overdue),
        schoolId: str(req.query.schoolId),
      });
      res.json({ success: true, data, message: "Assignments retrieved" });
    } catch (e) { next(e); }
  },

  async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.id);
      const data =
        req.user!.roleName === "STUDENT"
          ? await assignmentService.studentAssignmentDetail(req.user!, id)
          : await assignmentService.getAssignment(req.user!, id);
      res.json({ success: true, data, message: "Assignment retrieved" });
    } catch (e) { next(e); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.createAssignment(req.user!, req.body);
      res.status(201).json({ success: true, data, message: "Assignment created" });
    } catch (e) { next(e); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.updateAssignment(req.user!, getParam(req.params.id), req.body);
      res.json({ success: true, data, message: "Assignment updated" });
    } catch (e) { next(e); }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.deleteAssignment(req.user!, getParam(req.params.id));
      res.json({ success: true, data, message: "Assignment deleted" });
    } catch (e) { next(e); }
  },

  transition(to: "PUBLISHED" | "CLOSED" | "ARCHIVED") {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const data = await assignmentService.transitionAssignment(req.user!, getParam(req.params.id), to);
        const msg =
          to === "PUBLISHED" ? "Assignment published" : to === "CLOSED" ? "Assignment closed" : "Assignment archived";
        res.json({ success: true, data, message: msg });
      } catch (e) { next(e); }
    };
  },

  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.duplicateAssignment(req.user!, getParam(req.params.id));
      res.status(201).json({ success: true, data, message: "Assignment duplicated as draft" });
    } catch (e) { next(e); }
  },

  async submissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.listSubmissions(req.user!, getParam(req.params.id), {
        status: str(req.query.status),
        search: str(req.query.search),
      });
      res.json({ success: true, data, message: "Submissions retrieved" });
    } catch (e) { next(e); }
  },

  async grade(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.gradeSubmissions(req.user!, getParam(req.params.id), req.body.updates);
      res.json({ success: true, data, message: "Grading saved" });
    } catch (e) { next(e); }
  },

  async publishGrades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.publishGrades(
        req.user!,
        getParam(req.params.id),
        Array.isArray(req.body?.studentIds) ? req.body.studentIds : undefined
      );
      res.json({ success: true, data, message: "Grades published" });
    } catch (e) { next(e); }
  },

  async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.studentSubmit(req.user!, getParam(req.params.id), req.body ?? {});
      res.json({ success: true, data, message: "Assignment submitted" });
    } catch (e) { next(e); }
  },

  async history(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await assignmentService.submissionHistory(req.user!, getParam(req.params.id), str(req.query.studentId));
      res.json({ success: true, data, message: "Submission history retrieved" });
    } catch (e) { next(e); }
  },

  async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const file = (req as any).file as
        | { buffer: Buffer; originalname: string; mimetype: string; size: number }
        | undefined;
      if (!file?.buffer?.length) {
        res.status(400).json({ success: false, message: "No file received", code: "NO_FILE" });
        return;
      }
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

  async download(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = getParam(req.params.docId);
      const resolved = await assignmentService.authorizeAttachment(req.user!, id);
      if (resolved.kind === "redirect") {
        res.redirect(302, resolved.signedUrl);
        return;
      }
      res.setHeader("Content-Type", resolved.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${resolved.fileName.replace(/"/g, "")}"`);
      res.sendFile(resolved.absPath);
    } catch (e) { next(e); }
  },

  async reminders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { notificationService } = await import("../services/notificationService");
      const schoolId =
        (typeof req.body?.schoolId === "string" && req.body.schoolId) || req.user!.schoolId || undefined;
      const data = await notificationService.assignmentDueReminders(
        schoolId,
        typeof req.body?.hoursAhead === "number" ? req.body.hoursAhead : 48,
        !!req.user!.isSuperAdmin
      );
      res.json({ success: true, data, message: "Assignment reminders queued" });
    } catch (e) { next(e); }
  },
};
