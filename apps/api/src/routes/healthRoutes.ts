import { Router } from "express";
import { prisma } from "../config/database";
import { config } from "../config";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      service: "SchoolSphere ERP API",
      version: "1.0.0",
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    },
    message: "Server is running",
  });
});

router.get("/health", async (_req, res) => {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "healthy";
  } catch {
    checks.database = "unhealthy";
  }

  const allHealthy = Object.values(checks).every((s) => s === "healthy");
  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: checks,
    message: allHealthy ? "All systems healthy" : "Some systems degraded",
  });
});

export default router;