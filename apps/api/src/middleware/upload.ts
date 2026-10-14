import multer from "multer";
import { validateFile, uploadLimits } from "../services/storage/storageService";

// Memory storage: files are validated then persisted by storageService
// (never written to a public web root). Single-file uploads only.
export const uploadSingle = (field = "file") =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadLimits.maxFileSize, files: 1 },
    fileFilter: (_req, file, cb) => {
      try {
        validateFile(file.originalname, file.mimetype, 0);
        cb(null, true);
      } catch (err: any) {
        cb(err);
      }
    },
  }).single(field);
