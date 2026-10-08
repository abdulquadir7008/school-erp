import { Router } from "express";
import { settingsController } from "../controllers/settingsController";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { PERMISSIONS } from "../constants/permissions";
import {
  updateSettingsSchema,
  updateProfileSchema,
  createRoleSchema,
  updateRoleSchema,
  testChannelSchema,
} from "../validators/settingsValidator";

const router = Router();

router.use(authenticate);

router.get("/", authorize(PERMISSIONS.SETTINGS_MANAGE), settingsController.get);
router.get(
  "/roles",
  authorize(PERMISSIONS.ROLE_MANAGE),
  settingsController.listRoles
);
router.put(
  "/profile",
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateProfileSchema),
  settingsController.updateProfile
);
router.post(
  "/roles",
  authorize(PERMISSIONS.ROLE_MANAGE),
  validate(createRoleSchema),
  settingsController.createRole
);
router.put(
  "/roles/:id",
  authorize(PERMISSIONS.ROLE_MANAGE),
  validate(updateRoleSchema),
  settingsController.updateRole
);
router.post(
  "/send-test",
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(testChannelSchema),
  settingsController.sendTest
);
router.put(
  "/",
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSettingsSchema),
  settingsController.update
);

export default router;