/**
 * Video Routes
 */
import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  uploadVideo,
  listVideos,
  getVideo,
  streamVideo,
  updateVideo,
  deleteVideo,
  reprocessVideo,
} from "../controllers/video.controller";
import { auth, editorAndAbove, allRoles, videoUpload } from "../middleware";
import config from "../config";
import { User } from "../models";
import { JwtPayload } from "../types";

const router = Router();

/**
 * Stream auth middleware — accepts JWT via query param (for <video> element)
 * or the standard Authorization header.
 */
const streamAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const tokenFromQuery = req.query.token as string | undefined;
  if (tokenFromQuery) {
    try {
      const decoded = jwt.verify(
        tokenFromQuery,
        config.jwtSecret,
      ) as JwtPayload;
      const user = await User.findById(decoded.id).select("-password");
      if (user && user.isActive) {
        req.user = user;
        next();
        return;
      }
    } catch {
      // Fallback to standard auth below
    }
  }
  // Fallback to standard auth
  auth(req, res, next);
};

// GET /api/videos/:id/stream - Stream video (supports token via query param)
router.get("/:id/stream", streamAuth, streamVideo);

// All other routes require standard authentication
router.use(auth);

// GET /api/videos - List videos (all authenticated users)
router.get("/", allRoles, listVideos);

// POST /api/videos/upload - Upload video (editor & admin)
router.post("/upload", editorAndAbove, videoUpload, uploadVideo);

// GET /api/videos/:id - Video details
router.get("/:id", allRoles, getVideo);

// PUT /api/videos/:id - Update metadata (editor & admin)
router.put("/:id", editorAndAbove, updateVideo);

// DELETE /api/videos/:id - Delete video (editor & admin)
router.delete("/:id", editorAndAbove, deleteVideo);

// POST /api/videos/:id/reprocess - Reprocess video (editor & admin)
router.post("/:id/reprocess", editorAndAbove, reprocessVideo);

export default router;
