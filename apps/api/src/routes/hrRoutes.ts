import { Router } from "express";
import { hrController } from "../controllers/hrController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createLeaveSchema,
  updateLeaveStatusSchema,
  generatePayrollSchema,
} from "../validators/hrValidator";

const router = Router();

router.use(authenticate);

/* Dashboard */
router.get("/dashboard", authorize(PERMISSIONS.HR_VIEW), hrController.dashboard);

/* Departments */
router.get("/departments", authorize(PERMISSIONS.HR_VIEW), hrController.listDepartments);
router.post(
  "/departments",
  authorize(PERMISSIONS.HR_CREATE),
  validate(createDepartmentSchema),
  hrController.createDepartment
);
router.put(
  "/departments/:departmentId",
  authorize(PERMISSIONS.HR_EDIT),
  validate(updateDepartmentSchema),
  hrController.updateDepartment
);
router.delete(
  "/departments/:departmentId",
  authorize(PERMISSIONS.HR_EDIT),
  hrController.deleteDepartment
);

/* Employees */
router.get("/employees", authorize(PERMISSIONS.HR_VIEW), hrController.listEmployees);
router.get(
  "/employees/:employeeId",
  authorize(PERMISSIONS.HR_VIEW),
  hrController.getEmployeeById
);
router.post(
  "/employees",
  authorize(PERMISSIONS.HR_CREATE),
  validate(createEmployeeSchema),
  hrController.createEmployee
);
router.put(
  "/employees/:employeeId",
  authorize(PERMISSIONS.HR_EDIT),
  validate(updateEmployeeSchema),
  hrController.updateEmployee
);
router.delete(
  "/employees/:employeeId",
  authorize(PERMISSIONS.HR_EDIT),
  hrController.deleteEmployee
);

/* Leave */
router.get("/leaves", authorize(PERMISSIONS.HR_VIEW), hrController.listLeaves);
router.post(
  "/leaves",
  authorize(PERMISSIONS.HR_CREATE),
  validate(createLeaveSchema),
  hrController.createLeave
);
router.post(
  "/leaves/:leaveId/status",
  authorize(PERMISSIONS.HR_EDIT),
  validate(updateLeaveStatusSchema),
  hrController.updateLeaveStatus
);

/* Payroll */
router.get("/payroll", authorize(PERMISSIONS.PAYROLL_VIEW), hrController.listPayroll);
router.post(
  "/payroll/generate",
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  validate(generatePayrollSchema),
  hrController.generatePayroll
);
router.post(
  "/payroll/pay-all",
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  validate(generatePayrollSchema),
  hrController.payAllPending
);
router.post(
  "/payroll/:payrollId/pay",
  authorize(PERMISSIONS.PAYROLL_MANAGE),
  hrController.markPayrollPaid
);

export default router;