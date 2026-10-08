import { Router } from "express";
import { studentController } from "../controllers/studentController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createStudentSchema,
  updateStudentSchema,
} from "../validators/studentValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.STUDENT_VIEW), studentController.dashboard);
router.get("/", authorize(PERMISSIONS.STUDENT_VIEW), studentController.list);
router.get("/:id", authorize(PERMISSIONS.STUDENT_VIEW), studentController.getById);
router.post(
  "/",
  authorize(PERMISSIONS.STUDENT_CREATE),
  validate(createStudentSchema),
  studentController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.STUDENT_EDIT),
  validate(updateStudentSchema),
  studentController.update
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.STUDENT_DELETE),
  studentController.delete
);

export default router;