import { Router } from "express";
import { reportController } from "../controllers/reportController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { PERMISSIONS } from "../constants/permissions";

const router = Router();

router.use(authenticate);

router.get("/overview", authorize(PERMISSIONS.REPORT_VIEW), reportController.overview);
router.get("/students", authorize(PERMISSIONS.REPORT_VIEW), reportController.students);
router.get("/attendance", authorize(PERMISSIONS.REPORT_VIEW), reportController.attendance);
router.get("/finance", authorize(PERMISSIONS.REPORT_VIEW), reportController.finance);
router.get("/hr", authorize(PERMISSIONS.REPORT_VIEW), reportController.hr);
router.get("/library", authorize(PERMISSIONS.REPORT_VIEW), reportController.library);
router.get("/transport", authorize(PERMISSIONS.REPORT_VIEW), reportController.transport);

export default router;