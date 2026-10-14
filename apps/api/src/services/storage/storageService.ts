import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../../config/database";
import { config } from "../../config";
import { AppError } from "../../utils/errors";

// ============================================================
// File storage abstraction for assignment attachments.
// Mirrors the shared upload policy (@schoolsphere/config):
// 10 MB per file; image / pdf / doc / xls / csv families.
// - "local" driver (default): files live under STORAGE_DIR on the API
//   host and are served ONLY through the authenticated download
//   endpoint (never a public URL). Metadata is kept in `Document`.
// - "s3" driver: private bucket + short-lived signed download URLs.
//   Requires S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET and
//   `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` installed.
//   Until then every s3 call throws STORAGE_NOT_CONFIGURED.
// ============================================================

export const uploadLimits = {
  maxFileSize: 10 * 1024 * 1024,
  allowedExtensions: [
    "jpg", "jpeg", "png", "webp", "gif", // image
    "pdf",                               // pdf
    "doc", "docx",                       // doc
    "xls", "xlsx",                       // xls
    "csv",                               // csv
    "txt",                               // plain text answers
  ],
  allowedMimeTypes: [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv", "application/csv", "text/plain",
  ],
};

export function validateFile(originalName: string, mimeType: string, size: number) {
  const ext = (originalName.split(".").pop() || "").toLowerCase();
  if (!ext || !uploadLimits.allowedExtensions.includes(ext)) {
    throw new AppError(
      `File type .${ext || "?"} is not allowed. Allowed: ${uploadLimits.allowedExtensions.join(", ")}`,
      400,
      "INVALID_FILE_TYPE"
    );
  }
  if (!uploadLimits.allowedMimeTypes.includes(mimeType)) {
    throw new AppError(`MIME type ${mimeType} is not allowed`, 400, "INVALID_FILE_TYPE");
  }
  if (size > uploadLimits.maxFileSize) {
    throw new AppError(
      `File exceeds the ${Math.round(uploadLimits.maxFileSize / 1024 / 1024)} MB limit`,
      400,
      "FILE_TOO_LARGE"
    );
  }
  return ext;
}

function safeFileName(originalName: string) {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${crypto.randomUUID()}-${base}`;
}

function localKey(schoolId: string, fileName: string) {
  return path.join(schoolId, fileName);
}

function localAbsPath(key: string) {
  return path.join(path.resolve(config.storage.dir), key);
}

async function saveLocal(buffer: Buffer, key: string) {
  const abs = localAbsPath(key);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, buffer);
  return `local://${key}`;
}

function s3Configured() {
  return Boolean(config.s3.endpoint && config.s3.accessKey && config.s3.secretKey && config.s3.bucket);
}

function loadS3(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl };
  } catch {
    throw new AppError(
      "S3 storage requested but @aws-sdk/client-s3 is not installed. Run: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --workspace=apps/api, and set S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET.",
      500,
      "STORAGE_NOT_CONFIGURED"
    );
  }
}

function s3Client(sdk: any) {
  return new sdk.S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint || undefined,
    forcePathStyle: Boolean(config.s3.endpoint),
    credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
  });
}

export interface SaveFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  schoolId: string;
  entityType: string;
  entityId?: string | null;
  uploadedBy?: string | null;
}

export const storageService = {
  uploadLimits,

  async saveFile(input: SaveFileInput) {
    validateFile(input.originalName, input.mimeType, input.size);
    const driver = config.storage.driver;
    let url: string;
    if (driver === "s3") {
      if (!s3Configured()) {
        throw new AppError(
          "S3 storage requested but S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET are not configured. Set them or use STORAGE_DRIVER=local.",
          500,
          "STORAGE_NOT_CONFIGURED"
        );
      }
      const sdk = loadS3();
      const key = `schools/${input.schoolId}/${safeFileName(input.originalName)}`;
      await s3Client(sdk).send(
        new sdk.PutObjectCommand({
          Bucket: config.s3.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
        })
      );
      url = `s3://${config.s3.bucket}/${key}`;
    } else {
      const key = localKey(input.schoolId, safeFileName(input.originalName));
      url = await saveLocal(input.buffer, key);
    }
    const doc = await prisma.document.create({
      data: {
        name: path.basename(input.originalName).slice(0, 255),
        type: input.mimeType,
        url,
        size: input.size,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        schoolId: input.schoolId,
        uploadedBy: input.uploadedBy ?? null,
      },
    });
    return doc;
  },

  /** Resolve a download for an already-authorized document. */
  async resolveDownload(doc: { url: string; type: string; name: string }) {
    if (doc.url.startsWith("local://")) {
      const abs = localAbsPath(doc.url.replace("local://", ""));
      await fs.promises.access(abs, fs.constants.R_OK);
      return { kind: "local" as const, absPath: abs, mimeType: doc.type, fileName: doc.name };
    }
    if (doc.url.startsWith("s3://")) {
      if (!s3Configured()) throw new AppError("S3 storage is not configured", 500, "STORAGE_NOT_CONFIGURED");
      const sdk = loadS3();
      const key = doc.url.replace(`s3://${config.s3.bucket}/`, "");
      const signedUrl = await sdk.getSignedUrl(
        s3Client(sdk),
        new sdk.GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
        { expiresIn: 900 }
      );
      return { kind: "redirect" as const, signedUrl, mimeType: doc.type, fileName: doc.name };
    }
    throw new AppError("Unknown storage backend for this file", 500, "STORAGE_ERROR");
  },

  async deleteDocument(doc: { id: string; url: string }) {
    try {
      if (doc.url.startsWith("local://")) {
        await fs.promises.unlink(localAbsPath(doc.url.replace("local://", "")));
      } else if (doc.url.startsWith("s3://") && s3Configured()) {
        const sdk = loadS3();
        await s3Client(sdk).send(
          new sdk.DeleteObjectCommand({
            Bucket: config.s3.bucket,
            Key: doc.url.replace(`s3://${config.s3.bucket}/`, ""),
          })
        );
      }
    } catch {
      // File already gone — metadata cleanup below still applies.
    }
    await prisma.document.delete({ where: { id: doc.id } });
  },
};
