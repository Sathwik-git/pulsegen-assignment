import dotenv from "dotenv";
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/talentpulse",
  jwtSecret: process.env.JWT_SECRET || "fallback-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  maxFileSize: parseInt(
    process.env.MAX_FILE_SIZE || String(500 * 1024 * 1024),
    10,
  ),
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  allowedMimeTypes: [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/x-matroska",
  ] as const,
  huggingFaceToken: process.env.HUGGINGFACE_API_TOKEN || "",
  nsfwModel: "Falconsai/nsfw_image_detection",
  maxAnalysisFrames: parseInt(process.env.MAX_ANALYSIS_FRAMES || "10", 10),
  frameIntervalSeconds: parseInt(process.env.FRAME_INTERVAL_SECONDS || "5", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  roles: {
    VIEWER: "viewer",
    EDITOR: "editor",
    ADMIN: "admin",
  } as const,

  processingStatus: {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
  } as const,

  sensitivityClass: {
    SAFE: "safe",
    FLAGGED: "flagged",
    UNPROCESSED: "unprocessed",
  } as const,
} as const;

export type Role = (typeof config.roles)[keyof typeof config.roles];
export type ProcessingStatus =
  (typeof config.processingStatus)[keyof typeof config.processingStatus];
export type SensitivityClass =
  (typeof config.sensitivityClass)[keyof typeof config.sensitivityClass];

export default config;
