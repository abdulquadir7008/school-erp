import { Router } from "express";
import { credentialController } from "../controllers/credentialController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  provisionSchema,
  bulkProvisionSchema,
  setActiveSchema,
} from "../validators/credentialValidator";

const router = Router();

router.use(authenticate);

// Account directory (admin views login accounts + status)
router.get("/", authorize(PERMISSIONS.USER_VIEW), credentialController.list);

// Records without logins yet (powers bulk provisioning)
router.get(
  "/unprovisioned",
  authorize(PERMISSIONS.USER_VIEW),
  credentialController.unprovisioned
);

// Student / teacher provisioning
router.get(
  "/students/:id/status",
  authorize(PERMISSIONS.USER_VIEW),
  credentialController.studentStatus
);
router.post(
  "/students/:id/provision",
  authorize(PERMISSIONS.USER_CREATE),
  validate(provisionSchema),
  credentialController.provisionStudent
);
router.delete(
  "/students/:id/unlink",
  authorize(PERMISSIONS.USER_EDIT),
  credentialController.unlinkStudent
);

router.get(
  "/teachers/:id/status",
  authorize(PERMISSIONS.USER_VIEW),
  credentialController.teacherStatus
);
router.post(
  "/teachers/:id/provision",
  authorize(PERMISSIONS.USER_CREATE),
  validate(provisionSchema),
  credentialController.provisionTeacher
);
router.delete(
  "/teachers/:id/unlink",
  authorize(PERMISSIONS.USER_EDIT),
  credentialController.unlinkTeacher
);

// Bulk + lifecycle
router.post(
  "/bulk",
  authorize(PERMISSIONS.USER_CREATE),
  validate(bulkProvisionSchema),
  credentialController.bulk
);
router.post(
  "/users/:id/reset-password",
  authorize(PERMISSIONS.USER_EDIT),
  credentialController.reset
);
router.patch(
  "/users/:id/active",
  authorize(PERMISSIONS.USER_EDIT),
  validate(setActiveSchema),
  credentialController.setActive
);

export default router;
