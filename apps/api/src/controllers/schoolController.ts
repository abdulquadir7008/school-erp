import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { schoolService } from "../services/schoolService";
import { classService } from "../services/classService";
import { prisma } from "../config/database";

export const schoolController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.create(req.body);
      res.status(201).json({
        success: true,
        data: school,
        message: "School created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await schoolService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        status,
        schoolId: req.user?.schoolId || undefined,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });
      res.json({
        success: true,
        data: result.data,
        message: "Schools retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.getById(
        getParam(req.params.id),
        req.user?.isSuperAdmin || false,
        req.user?.schoolId || undefined
      );
      res.json({
        success: true,
        data: school,
        message: "School retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.update(
        getParam(req.params.id),
        req.body,
        req.user?.isSuperAdmin || false,
        req.user?.schoolId || undefined
      );
      res.json({
        success: true,
        data: school,
        message: "School updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async setStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const school = await schoolService.setStatus(
        getParam(req.params.id),
        req.body.status,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: school,
        message: "School status updated",
      });
    } catch (error) {
      next(error);
    }
  },

  async resetAdminPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await schoolService.resetAdminPassword(
        getParam(req.params.id),
        req.body.password
      );
      res.json({
        success: true,
        data: result,
        message: "School admin password reset successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await schoolService.delete(
        getParam(req.params.id),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "School deleted",
      });
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await schoolService.getDashboardStats(
        req.user?.schoolId || "",
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Dashboard stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async listClasses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getParam(req.params.schoolId);
      let currentYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!currentYear) {
        currentYear = await prisma.academicYear.findFirst({
          where: { schoolId },
          orderBy: { startDate: "desc" },
          select: { id: true },
        });
      }
      const classes = await prisma.schoolClass.findMany({
        where: { schoolId, ...(currentYear ? { academicYearId: currentYear.id } : {}) },
        select: {
          id: true,
          name: true,
          code: true,
          academicYearId: true,
          sections: {
            select: {
              id: true,
              name: true,
              _count: { select: { students: true } },
            },
            orderBy: { name: "asc" },
          },
          _count: { select: { students: true } },
        },
      });
      const classOrder = [
        "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
        "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11",
        "Class 12",
      ];
      const rank: Record<string, number> = {};
      classOrder.forEach((name, i) => {
        rank[name] = i;
      });
      classes.sort((a, b) => (rank[a.name] ?? 99) - (rank[b.name] ?? 99));
      res.json({ success: true, data: classes, message: "Classes retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async listSections(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const classId = getParam(req.params.classId);
      const sections = await prisma.section.findMany({
        where: { classId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: sections, message: "Sections retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async setupDefaultClasses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await classService.setupDefaults(
        req.user!,
        getParam(req.params.schoolId)
      );
      res.status(201).json({
        success: true,
        data: result,
        message: "Default classes created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async createClass(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cls = await classService.createClass(
        req.user!,
        getParam(req.params.schoolId),
        req.body
      );
      res.status(201).json({
        success: true,
        data: cls,
        message: "Class created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async createSection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const section = await classService.createSection(
        req.user!,
        getParam(req.params.schoolId),
        getParam(req.params.classId),
        req.body
      );
      res.status(201).json({
        success: true,
        data: section,
        message: "Section created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async removeClass(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await classService.deleteClass(
        req.user!,
        getParam(req.params.schoolId),
        getParam(req.params.classId)
      );
      res.json({ success: true, data: result, message: "Class deleted" });
    } catch (error) {
      next(error);
    }
  },

  async removeSection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await classService.deleteSection(
        req.user!,
        getParam(req.params.schoolId),
        getParam(req.params.classId),
        getParam(req.params.sectionId)
      );
      res.json({ success: true, data: result, message: "Section deleted" });
    } catch (error) {
      next(error);
    }
  },
};