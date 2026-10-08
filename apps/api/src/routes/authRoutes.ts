import { Router } from "express";
import { authController } from "../controllers/authController";
import { validate } from "../middleware/errorHandler";
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  changePasswordSchema,
} from "../validators/authValidator";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", authenticate, authController.logout);
router.get("/profile", authenticate, authController.profile);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;