import { Router } from "express";
import { schoolController } from "../controllers/schoolController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  createSchoolSchema,
  updateSchoolSchema,
  setSchoolStatusSchema,
  resetAdminPasswordSchema,
} from "../validators/schoolValidator";
import {
  createClassSchema,
  createSectionSchema,
} from "../validators/classValidator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", schoolController.dashboard);
router.get("/", authorize(PERMISSIONS.SCHOOL_VIEW), schoolController.list);
router.post(
  "/",
  authorize(PERMISSIONS.SCHOOL_CREATE),
  validate(createSchoolSchema),
  schoolController.create
);
router.get(
  "/:schoolId/classes/:classId/sections",
  authorize(PERMISSIONS.SCHOOL_VIEW),
  schoolController.listSections
);
router.post(
  "/:schoolId/classes/setup-defaults",
  authorize(PERMISSIONS.ACADEMICS_CREATE),
  schoolController.setupDefaultClasses
);
router.post(
  "/:schoolId/classes",
  authorize(PERMISSIONS.ACADEMICS_CREATE),
  validate(createClassSchema),
  schoolController.createClass
);
router.post(
  "/:schoolId/classes/:classId/sections",
  authorize(PERMISSIONS.ACADEMICS_CREATE),
  validate(createSectionSchema),
  schoolController.createSection
);
router.delete(
  "/:schoolId/classes/:classId/sections/:sectionId",
  authorize(PERMISSIONS.ACADEMICS_EDIT),
  schoolController.removeSection
);
router.delete(
  "/:schoolId/classes/:classId",
  authorize(PERMISSIONS.ACADEMICS_EDIT),
  schoolController.removeClass
);
router.get(
  "/:schoolId/classes",
  authorize(PERMISSIONS.SCHOOL_VIEW),
  schoolController.listClasses
);
router.get("/:id", authorize(PERMISSIONS.SCHOOL_VIEW), schoolController.getById);
router.put(
  "/:id",
  authorize(PERMISSIONS.SCHOOL_EDIT),
  validate(updateSchoolSchema),
  schoolController.update
);
router.patch(
  "/:id/status",
  authorize(PERMISSIONS.SCHOOL_EDIT),
  validate(setSchoolStatusSchema),
  schoolController.setStatus
);
router.patch(
  "/:id/password",
  authorize(PERMISSIONS.SCHOOL_EDIT),
  validate(resetAdminPasswordSchema),
  schoolController.resetAdminPassword
);
router.delete(
  "/:id",
  authorize(PERMISSIONS.SCHOOL_DELETE),
  schoolController.remove
);

export default router;