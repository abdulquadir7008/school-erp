import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { settingsService } from "../services/settingsService";
import { schoolService } from "../services/schoolService";
import { TenantError } from "../utils/errors";

const getSchoolIdQuery = (req: AuthRequest): string | undefined => {
  const schoolId = req.query.schoolId;
  return typeof schoolId === "string" && schoolId ? schoolId : undefined;
};

export const settingsController = {
  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await settingsService.get(req.user!, getSchoolIdQuery(req));
      res.json({ success: true, data, message: "Settings retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await settingsService.update(
        req.user!,
        req.body,
        getSchoolIdQuery(req)
      );
      res.json({ success: true, data, message: "Settings updated successfully" });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getSchoolIdQuery(req) || req.user!.schoolId || getParam(req.params.id);

      if (!schoolId) {
        throw new TenantError("No school context for this account");
      }

      const school = await schoolService.update(
        schoolId,
        req.body,
        req.user!.isSuperAdmin,
        req.user!.schoolId || undefined
      );

      res.json({
        success: true,
        data: school,
        message: "School profile updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async listRoles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await settingsService.listRoles(
        req.user!,
        getSchoolIdQuery(req)
      );
      res.json({ success: true, data, message: "Roles retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = await settingsService.createRole(
        req.user!,
        req.body,
        getSchoolIdQuery(req)
      );
      res.status(201).json({
        success: true,
        data: role,
        message: "Role created successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async updateRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const role = await settingsService.updateRole(
        req.user!,
        getParam(req.params.id),
        req.body,
        getSchoolIdQuery(req)
      );
      res.json({
        success: true,
        data: role,
        message: "Role updated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async sendTest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { channel, to } = req.body;
      const result = await settingsService.sendTest(
        req.user!,
        channel,
        to,
        getSchoolIdQuery(req)
      );
      res.json({
        success: true,
        data: result,
        message: "Test message sent",
      });
    } catch (error) {
      next(error);
    }
  },
};