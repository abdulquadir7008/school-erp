import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { academicsService } from "../services/academicsService";
import { notificationService } from "../services/notificationService";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export const academicsController = {
  async timetable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.listTimetable(req.user!, {
        classId: str(req.query.classId),
        teacherId: str(req.query.teacherId),
        schoolId: str(req.query.schoolId),
      });
      res.json({ success: true, data, message: "Timetable retrieved" });
    } catch (e) { next(e); }
  },

  async createTimetable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.createTimetable(req.user!, req.body);
      res.status(201).json({ success: true, data, message: "Timetable entry created" });
    } catch (e) { next(e); }
  },

  async deleteTimetable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.deleteTimetable(req.user!, getParam(req.params.id));
      res.json({ success: true, data, message: "Timetable entry deleted" });
    } catch (e) { next(e); }
  },

  async homework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.listHomework(req.user!, {
        classId: str(req.query.classId),
        sectionId: str(req.query.sectionId),
        subjectId: str(req.query.subjectId),
        status: str(req.query.status),
        priority: str(req.query.priority),
        search: str(req.query.search),
        from: str(req.query.from),
        to: str(req.query.to),
        overdue: str(req.query.overdue),
        schoolId: str(req.query.schoolId),
      });
      res.json({ success: true, data, message: "Homework retrieved" });
    } catch (e) { next(e); }
  },

  async homeworkDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.getHomework(req.user!, getParam(req.params.id));
      res.json({ success: true, data, message: "Homework retrieved" });
    } catch (e) { next(e); }
  },

  async createHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.createHomework(req.user!, req.body);
      res.status(201).json({ success: true, data, message: "Homework published" });
    } catch (e) { next(e); }
  },

  async updateHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.updateHomework(req.user!, getParam(req.params.id), req.body);
      res.json({ success: true, data, message: "Homework updated" });
    } catch (e) { next(e); }
  },

  async deleteHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.deleteHomework(req.user!, getParam(req.params.id));
      res.json({ success: true, data, message: "Homework deleted" });
    } catch (e) { next(e); }
  },

  async publishHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.publishHomework(req.user!, getParam(req.params.id));
      res.json({ success: true, data, message: "Homework published" });
    } catch (e) { next(e); }
  },

  async homeworkCompletions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.listCompletions(req.user!, getParam(req.params.id), {
        status: str(req.query.status),
        search: str(req.query.search),
      });
      res.json({ success: true, data, message: "Completion status retrieved" });
    } catch (e) { next(e); }
  },

  async updateCompletions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.updateCompletions(
        req.user!,
        getParam(req.params.id),
        req.body.updates
      );
      res.json({ success: true, data, message: "Completion status updated" });
    } catch (e) { next(e); }
  },

  async homeworkReminders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId =
        (typeof req.body?.schoolId === "string" && req.body.schoolId) ||
        req.user!.schoolId ||
        undefined;
      const data = await notificationService.homeworkDueReminders(
        schoolId,
        typeof req.body?.hoursAhead === "number" ? req.body.hoursAhead : 48,
        !!req.user!.isSuperAdmin
      );
      res.json({ success: true, data, message: "Due reminders queued" });
    } catch (e) { next(e); }
  },

  async submitHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.studentSubmit(req.user!, getParam(req.params.id), req.body);
      res.json({ success: true, data, message: "Homework submitted" });
    } catch (e) { next(e); }
  },

  async assignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.listAssignments(req.user!, {
        classId: str(req.query.classId),
        schoolId: str(req.query.schoolId),
      });
      res.json({ success: true, data, message: "Assignments retrieved" });
    } catch (e) { next(e); }
  },

  async createAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.createAssignment(req.user!, req.body);
      res.status(201).json({ success: true, data, message: "Assignment published" });
    } catch (e) { next(e); }
  },
};
