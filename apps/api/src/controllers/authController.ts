import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { authService } from "../services/authService";

export const authController = {
  async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        data: result,
        message: "Registration successful",
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json({
        success: true,
        data: result,
        message: "Login successful",
      });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      res.json({
        success: true,
        data: result,
        message: "Token refreshed",
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(req.user!.id, refreshToken);
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  async profile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const profile = await authService.getProfile(req.user!.id);
      res.json({
        success: true,
        data: profile,
        message: "Profile retrieved",
      });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.changePassword(
        req.user!.id,
        req.body.currentPassword,
        req.body.newPassword
      );
      res.json({
        success: true,
        data: result,
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  },
};