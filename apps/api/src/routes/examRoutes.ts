import { Router } from "express";
import { examController } from "../controllers/examController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createExamSchema,
  updateExamSchema,
  updateExamStatusSchema,
} from "../validators/examValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.EXAM_VIEW), examController.dashboard);
router.get("/", authorize(PERMISSIONS.EXAM_VIEW), examController.list);
router.get("/:id", authorize(PERMISSIONS.EXAM_VIEW), examController.getById);
router.get("/:id/results", authorize(PERMISSIONS.EXAM_RESULTS), examController.getResults);
router.post(
  "/",
  authorize(PERMISSIONS.EXAM_CREATE),
  validate(createExamSchema),
  examController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(updateExamSchema),
  examController.update
);
router.patch(
  "/:id/status",
  authorize(PERMISSIONS.EXAM_EDIT),
  validate(updateExamStatusSchema),
  examController.updateStatus
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.EXAM_EDIT),
  examController.delete
);

export default router;