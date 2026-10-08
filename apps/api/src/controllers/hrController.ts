import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { hrService } from "../services/hrService";
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

export const hrController = {
  /* Dashboard */
  async dashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      const stats = await hrService.getDashboardStats(
        schoolId,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: stats, message: "HR dashboard stats retrieved" });
    } catch (error) {
      next(error);
    }
  },

  /* Departments */
  async listDepartments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const departments = await hrService.listDepartments(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: departments, message: "Departments retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createDepartment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");
      const department = await hrService.createDepartment(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({ success: true, data: department, message: "Department added" });
    } catch (error) {
      next(error);
    }
  },

  async updateDepartment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const department = await hrService.updateDepartment(
        getParam(req.params.departmentId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: department, message: "Department updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteDepartment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await hrService.deleteDepartment(
        getParam(req.params.departmentId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Department removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Employees */
  async listEmployees(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const employees = await hrService.listEmployees(
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: employees, message: "Employees retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async getEmployeeById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const employee = await hrService.getEmployeeById(
        getParam(req.params.employeeId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: employee, message: "Employee retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createEmployee(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schoolId = getContextSchoolId(req);
      if (!schoolId) throw new TenantError("School context required");
      const employee = await hrService.createEmployee(
        { ...req.body, schoolId },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({ success: true, data: employee, message: "Employee added" });
    } catch (error) {
      next(error);
    }
  },

  async updateEmployee(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const employee = await hrService.updateEmployee(
        getParam(req.params.employeeId),
        getContextSchoolId(req),
        req.body,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: employee, message: "Employee updated" });
    } catch (error) {
      next(error);
    }
  },

  async deleteEmployee(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await hrService.deleteEmployee(
        getParam(req.params.employeeId),
        getContextSchoolId(req),
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: result, message: "Employee removed" });
    } catch (error) {
      next(error);
    }
  },

  /* Leave */
  async listLeaves(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const leaves = await hrService.listLeaves({
        schoolId: getContextSchoolId(req),
        isSuperAdmin: req.user?.isSuperAdmin || false,
        status,
      });
      res.json({ success: true, data: leaves, message: "Leave requests retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async createLeave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const leave = await hrService.createLeave(
        { ...req.body, schoolId: getContextSchoolId(req) },
        req.user?.isSuperAdmin || false
      );
      res.status(201).json({ success: true, data: leave, message: "Leave request added" });
    } catch (error) {
      next(error);
    }
  },

  async updateLeaveStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const updated = await hrService.updateLeaveStatus(
        getParam(req.params.leaveId),
        req.body.status,
        getContextSchoolId(req),
        req.user?.id,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: updated, message: "Leave request updated" });
    } catch (error) {
      next(error);
    }
  },

  /* Payroll */
  async listPayroll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const month = typeof req.query.month === "string" ? parseInt(req.query.month) : undefined;
      const year = typeof req.query.year === "string" ? parseInt(req.query.year) : undefined;
      const rows = await hrService.listPayroll({
        schoolId: getContextSchoolId(req),
        isSuperAdmin: req.user?.isSuperAdmin || false,
        month: Number.isNaN(month) ? undefined : month,
        year: Number.isNaN(year) ? undefined : year,
      });
      res.json({ success: true, data: rows, message: "Payroll records retrieved" });
    } catch (error) {
      next(error);
    }
  },

  async generatePayroll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await hrService.generatePayroll(
        req.body,
        req.user?.isSuperAdmin || false,
        req.user?.schoolId || undefined
      );
      res.status(201).json({ success: true, data: result, message: "Payroll generated" });
    } catch (error) {
      next(error);
    }
  },

  async markPayrollPaid(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const row = await hrService.markPayrollPaid(
        getParam(req.params.payrollId),
        getContextSchoolId(req),
        req.user?.id,
        req.user?.isSuperAdmin || false
      );
      res.json({ success: true, data: row, message: "Payroll marked as paid" });
    } catch (error) {
      next(error);
    }
  },

  async payAllPending(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await hrService.payAllPending(
        req.body,
        req.user?.isSuperAdmin || false,
        req.user?.schoolId || undefined,
        req.user?.id
      );
      res.json({ success: true, data: result, message: "Pending payroll marked as paid" });
    } catch (error) {
      next(error);
    }
  },
};