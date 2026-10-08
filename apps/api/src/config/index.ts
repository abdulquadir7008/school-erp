import dotenv from "dotenv";
dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  apiPrefix: process.env.API_PREFIX || "/api/v1",

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },

  // Global super admin ensured on every boot (created if missing,
  // password synced if different). Set these on the host (Render env
  // vars / .env) instead of running seed scripts.
  superadmin: {
    email: process.env.SUPERADMIN_EMAIL || "admin@schoolsphere.test",
    password: process.env.SUPERADMIN_PASSWORD || "Admin@2024",
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    accessKey: process.env.S3_ACCESS_KEY || "",
    secretKey: process.env.S3_SECRET_KEY || "",
    bucket: process.env.S3_BUCKET || "schoolsphere-dev",
    region: process.env.S3_REGION || "ap-south-1",
  },

  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
  },

  email: {
    from: process.env.EMAIL_FROM || "noreply@schoolsphere.com",
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
};
