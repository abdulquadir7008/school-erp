import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { academicsService } from "../services/academicsService";

export const academicsController = {
  async timetable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.listTimetable(req.user!, {
        classId: typeof req.query.classId === "string" ? req.query.classId : undefined,
        teacherId: typeof req.query.teacherId === "string" ? req.query.teacherId : undefined,
        schoolId: typeof req.query.schoolId === "string" ? req.query.schoolId : undefined,
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
        classId: typeof req.query.classId === "string" ? req.query.classId : undefined,
        schoolId: typeof req.query.schoolId === "string" ? req.query.schoolId : undefined,
      });
      res.json({ success: true, data, message: "Homework retrieved" });
    } catch (e) { next(e); }
  },

  async createHomework(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.createHomework(req.user!, req.body);
      res.status(201).json({ success: true, data, message: "Homework published" });
    } catch (e) { next(e); }
  },

  async assignments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await academicsService.listAssignments(req.user!, {
        classId: typeof req.query.classId === "string" ? req.query.classId : undefined,
        schoolId: typeof req.query.schoolId === "string" ? req.query.schoolId : undefined,
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
