import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import config from "../config";


const uploadPath = path.join(__dirname, "../../", config.uploadDir);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  if ((config.allowedMimeTypes as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Invalid file type: ${file.mimetype}. Allowed types: ${config.allowedMimeTypes.join(", ")}`,
      ),
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSize,
    files: 1,
  },
});

const videoUpload = (req: Request, res: Response, next: NextFunction): void => {
  const uploadSingle = upload.single("video");

  uploadSingle(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      let message = "Upload error.";
      switch (err.code) {
        case "LIMIT_FILE_SIZE":
          message = `File too large. Maximum size: ${(config.maxFileSize / (1024 * 1024)).toFixed(0)}MB.`;
          break;
        case "LIMIT_UNEXPECTED_FILE":
          message = err.message || "Unexpected file type.";
          break;
        case "LIMIT_FILE_COUNT":
          message = "Only one file can be uploaded at a time.";
          break;
        default:
          message = err.message;
      }
      res.status(400).json({ success: false, message });
      return;
    }
    if (err) {
      const errMsg = err instanceof Error ? err.message : "Upload failed";
      res.status(500).json({ success: false, message: errMsg });
      return;
    }
    if (!req.file) {
      res
        .status(400)
        .json({ success: false, message: "No video file provided." });
      return;
    }
    next();
  });
};

export { videoUpload };
