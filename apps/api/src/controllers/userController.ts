import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { userService } from "../services/userService";

export const userController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
      const roleName = typeof req.query.role === "string" ? req.query.role : undefined;
      const result = await userService.list({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        search,
        schoolId,
        roleName,
        isSuperAdmin: req.user?.isSuperAdmin || false,
        requesterSchoolId: req.user?.schoolId || undefined,
        requesterRole: req.user?.roleName,
      });
      res.json({
        success: true,
        data: result.data,
        message: "Users retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.create(req.body);
      res.status(201).json({
        success: true,
        data: user,
        message: "User created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.update(getParam(req.params.id), req.body);
      res.json({
        success: true,
        data: user,
        message: "User updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await userService.delete(getParam(req.params.id));
      res.json({
        success: true,
        data: result,
        message: "User deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async auditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
      const result = await userService.getAuditLogs({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        schoolId,
        isSuperAdmin: req.user?.isSuperAdmin || false,
        requesterSchoolId: req.user?.schoolId || undefined,
      });
      res.json({
        success: true,
        data: result.data,
        message: "Audit logs retrieved",
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  },
};