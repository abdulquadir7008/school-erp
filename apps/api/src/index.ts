import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import authRoutes from "./routes/authRoutes";
import schoolRoutes from "./routes/schoolRoutes";
import userRoutes from "./routes/userRoutes";
import studentRoutes from "./routes/studentRoutes";
import parentRoutes from "./routes/parentRoutes";
import teacherRoutes from "./routes/teacherRoutes";
import subjectRoutes from "./routes/subjectRoutes";
import attendanceRoutes from "./routes/attendanceRoutes";
import feeRoutes from "./routes/feeRoutes";
import examRoutes from "./routes/examRoutes";
import libraryRoutes from "./routes/libraryRoutes";
import transportRoutes from "./routes/transportRoutes";
import hrRoutes from "./routes/hrRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import reportRoutes from "./routes/reportRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import healthRoutes from "./routes/healthRoutes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { initializeRoles, createDefaultSubscriptionPlans } from "./services/schoolService";
import "./jobs/queue";

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: config.cors.origin.split(","),
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

app.use(config.apiPrefix, limiter);

app.use(`${config.apiPrefix}/health`, healthRoutes);
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/schools`, schoolRoutes);
app.use(`${config.apiPrefix}/users`, userRoutes);
app.use(`${config.apiPrefix}/students`, studentRoutes);
app.use(`${config.apiPrefix}/parents`, parentRoutes);
app.use(`${config.apiPrefix}/teachers`, teacherRoutes);
app.use(`${config.apiPrefix}/subjects`, subjectRoutes);
app.use(`${config.apiPrefix}/attendance`, attendanceRoutes);
app.use(`${config.apiPrefix}/fees`, feeRoutes);
app.use(`${config.apiPrefix}/exams`, examRoutes);
app.use(`${config.apiPrefix}/library`, libraryRoutes);
app.use(`${config.apiPrefix}/transport`, transportRoutes);
app.use(`${config.apiPrefix}/hr`, hrRoutes);
app.use(`${config.apiPrefix}/inventory`, inventoryRoutes);
app.use(`${config.apiPrefix}/reports`, reportRoutes);
app.use(`${config.apiPrefix}/settings`, settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const initialize = async () => {
  await initializeRoles();
  await createDefaultSubscriptionPlans();
};

const port = config.port;

const server = app.listen(port, async () => {
  try {
    await initialize();
    console.log(`SchoolSphere API running on port ${port}`);
  } catch (error) {
    console.error("Failed to initialize:", error);
  }
});

export { app, server };