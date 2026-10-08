import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { parentService } from "../services/parentService";
import { TenantError } from "../utils/errors";
import { getParam } from "../utils/request";

const getContextSchoolId = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId || req.params.schoolId) as
      | string
      | undefined;
  }
  return req.user?.schoolId || undefined;
};

export const parentController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");

      const parent = await parentService.create({
        ...req.body,
        schoolId,
      });

      res.status(201).json({
        success: true,
        data: parent,
        message: "Parent created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const result = await parentService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
      });

      res.json({
        success: true,
        data: result.data,
        message: "Parents retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parent = await parentService.getById(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: parent,
        message: "Parent retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parent = await parentService.update(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: parent,
        message: "Parent updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await parentService.delete(
        getParam(req.params.id),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: result,
        message: "Parent deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await parentService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({
        success: true,
        data: stats,
        message: "Parent stats retrieved",
      });
    } catch (error) {
      next(error);
    }
  },
};