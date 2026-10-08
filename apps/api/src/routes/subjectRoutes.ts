import { Router } from "express";
import { subjectController } from "../controllers/subjectController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import { createSubjectSchema, updateSubjectSchema } from "../validators/subjectValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", authorize(PERMISSIONS.ACADEMICS_VIEW), subjectController.dashboard);
router.get("/", authorize(PERMISSIONS.ACADEMICS_VIEW), subjectController.list);
router.get("/:id", authorize(PERMISSIONS.ACADEMICS_VIEW), subjectController.getById);
router.post(
  "/",
  authorize(PERMISSIONS.ACADEMICS_CREATE),
  validate(createSubjectSchema),
  subjectController.create
);
router.put(
  "/:id",
  authorize(PERMISSIONS.ACADEMICS_EDIT),
  validate(updateSubjectSchema),
  subjectController.update
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.ACADEMICS_EDIT),
  subjectController.delete
);

export default router;