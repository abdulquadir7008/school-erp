import { Router } from "express";
import { teacherController } from "../controllers/teacherController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import { createTeacherSchema, updateTeacherSchema } from "../validators/teacherValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.TEACHER_VIEW), teacherController.dashboard);
router.get("/", authorize(PERMISSIONS.TEACHER_VIEW), teacherController.list);
router.get("/:id", authorize(PERMISSIONS.TEACHER_VIEW), teacherController.getById);
router.post(
  "/",
  authorize(PERMISSIONS.TEACHER_CREATE),
  validate(createTeacherSchema),
  teacherController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.TEACHER_EDIT),
  validate(updateTeacherSchema),
  teacherController.update
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.TEACHER_DELETE),
  teacherController.delete
);

export default router;