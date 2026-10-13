import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { getParam } from "../utils/request";
import { credentialService } from "../services/credentialService";
import { TenantError } from "../utils/errors";

const ctxSchool = (req: AuthRequest): string | undefined => {
  if (req.user?.isSuperAdmin) {
    return (req.body.schoolId || req.query.schoolId) as string | undefined;
  }
  return req.user?.schoolId || undefined;
};

export const credentialController = {
  async studentStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const s = await credentialService.getStudentAccount(
        getParam(req.params.id), ctxSchool(req), req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: s, message: "Student account status" });
    } catch (e) { next(e); }
  },

  async teacherStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const s = await credentialService.getTeacherAccount(
        getParam(req.params.id), ctxSchool(req), req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: s, message: "Teacher account status" });
    } catch (e) { next(e); }
  },

  async provisionStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = ctxSchool(req);
      if (!schoolId) throw new TenantError("School context required");
      const r = await credentialService.provisionStudent(
        getParam(req.params.id), schoolId,
        { username: req.body.username, password: req.body.password },
        req.user?.id
      );
      res.status(r.created ? 201 : 200).json({
        success: true, data: r,
        message: r.created
          ? "Student login created. Share username + temporary password securely."
          : "Student already has a login account",
      });
    } catch (e) { next(e); }
  },

  async provisionTeacher(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = ctxSchool(req);
      if (!schoolId) throw new TenantError("School context required");
      const r = await credentialService.provisionTeacher(
        getParam(req.params.id), schoolId,
        { username: req.body.username, password: req.body.password },
        req.user?.id
      );
      res.status(r.created ? 201 : 200).json({
        success: true, data: r,
        message: r.created
          ? "Teacher login created. Share username + temporary password securely."
          : "Teacher already has a login account",
      });
    } catch (e) { next(e); }
  },

  async bulk(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = ctxSchool(req);
      if (!schoolId) throw new TenantError("School context required");
      const { kind, ids } = req.body as { kind: "student" | "teacher"; ids: string[] };
      const r = await credentialService.bulkProvision(kind, ids || [], schoolId, req.user?.id);
      res.status(201).json({ success: true, data: r, message: "Bulk provisioning complete" });
    } catch (e) { next(e); }
  },

  async reset(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const r = await credentialService.resetPassword(
        getParam(req.params.id), ctxSchool(req), req.user?.isSuperAdmin || false, req.user?.id
      );
      res.json({
        success: true, data: r,
        message: "Password reset. Share the temporary password securely; user must change it after login.",
      });
    } catch (e) { next(e); }
  },

  async setActive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const r = await credentialService.setActive(
        getParam(req.params.id), !!req.body.isActive,
        ctxSchool(req), req.user?.isSuperAdmin || false, req.user?.id
      );
      res.json({ success: true, data: r, message: req.body.isActive ? "Access enabled" : "Access disabled" });
    } catch (e) { next(e); }
  },

  async unlinkStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = ctxSchool(req);
      if (!schoolId) throw new TenantError("School context required");
      const r = await credentialService.unlink("student", getParam(req.params.id), schoolId, req.user?.id);
      res.json({ success: true, data: r, message: "Student login unlinked and deactivated" });
    } catch (e) { next(e); }
  },

  async unlinkTeacher(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = ctxSchool(req);
      if (!schoolId) throw new TenantError("School context required");
      const r = await credentialService.unlink("teacher", getParam(req.params.id), schoolId, req.user?.id);
      res.json({ success: true, data: r, message: "Teacher login unlinked and deactivated" });
    } catch (e) { next(e); }
  },

  async unprovisioned(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const kind = req.query.kind === "teacher" ? "teacher" : "student";
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
      const r = await credentialService.listUnprovisioned({
        kind: kind as "student" | "teacher",
        schoolId,
        search,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        isSuperAdmin: req.user?.isSuperAdmin || false,
        requesterSchoolId: req.user?.schoolId || undefined,
      });
      res.json({ success: true, data: r.data, message: "Records without logins retrieved", meta: r.meta });
    } catch (e) { next(e); }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {    try {
      const roleName = typeof req.query.role === "string" ? req.query.role : undefined;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const schoolId = typeof req.query.schoolId === "string" ? req.query.schoolId : undefined;
      const r = await credentialService.listAccounts({
        schoolId, roleName, search,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
        isSuperAdmin: req.user?.isSuperAdmin || false,
        requesterSchoolId: req.user?.schoolId || undefined,
      });
      res.json({ success: true, data: r.data, message: "Login accounts retrieved", meta: r.meta });
    } catch (e) { next(e); }
  },
};
