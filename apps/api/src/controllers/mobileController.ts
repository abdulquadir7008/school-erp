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

  async exams(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data =
        req.user!.roleName === "TEACHER"
          ? await mobileService.teacherExams(req.user!)
          : await mobileService.studentExams(req.user!);
      res.json({ success: true, data, message: "Examinations retrieved" });
    } catch (e) { next(e); }
  },

  async results(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileService.studentResults(req.user!);
      res.json({ success: true, data, message: "Published results retrieved" });
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
