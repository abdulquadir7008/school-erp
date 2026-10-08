import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config";

// Redis is optional. Free hosts (e.g. Render free tier) have no Redis
// service, and nothing in the request path depends on queues — so set
// REDIS_ENABLED=false to boot the API without Redis. Enqueue calls then
// become harmless no-ops and no connection is attempted.
const redisEnabled = process.env.REDIS_ENABLED !== "false";

export const connection: IORedis | null = redisEnabled
  ? new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
    })
  : null;

if (connection) {
  // Prevent an unhandled 'error' event from crashing the process when
  // Redis is unreachable; BullMQ will keep retrying in the background.
  connection.on("error", (err) => {
    console.error("Redis connection error:", err.message);
  });
}

const noopQueue = {
  add: async (..._args: unknown[]) => undefined,
} as unknown as Queue;

export const queues = {
  email: connection ? new Queue("sendEmail", { connection }) : noopQueue,
  sms: connection ? new Queue("sendSMS", { connection }) : noopQueue,
  whatsapp: connection ? new Queue("sendWhatsApp", { connection }) : noopQueue,
  report: connection ? new Queue("generateReport", { connection }) : noopQueue,
  pdf: connection ? new Queue("generatePDF", { connection }) : noopQueue,
  import: connection ? new Queue("processImport", { connection }) : noopQueue,
  feeReminder: connection
    ? new Queue("feeReminder", { connection })
    : noopQueue,
  attendanceNotification: connection
    ? new Queue("attendanceNotification", { connection })
    : noopQueue,
  backup: connection ? new Queue("backupDatabase", { connection }) : noopQueue,
};

export const enqueueEmail = async (
  to: string,
  subject: string,
  html: string
) => {
  await queues.email.add("send", { to, subject, html });
};

export const enqueueNotification = async (
  userId: string,
  title: string,
  message: string
) => {
  await queues.email.add("inApp", { userId, title, message });
};

if (connection) {
  const emailWorker = new Worker(
    "sendEmail",
    async (job) => {
      const { to, subject, html } = job.data;
      if (config.smtp.host) {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          auth: {
            user: config.smtp.user,
            pass: config.smtp.pass,
          },
        });
        await transporter.sendMail({
          from: config.email.from,
          to,
          subject,
          html,
        });
      }
    },
    { connection }
  );

  emailWorker.on("failed", (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err.message);
  });
}

export const queueService = { queues, enqueueEmail, enqueueNotification };
