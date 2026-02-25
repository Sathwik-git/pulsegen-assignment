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


router.get("/:id/stream", streamAuth, streamVideo);


router.use(auth);


router.get("/", allRoles, listVideos);


router.post("/upload", editorAndAbove, videoUpload, uploadVideo);


router.get("/:id", allRoles, getVideo);


router.put("/:id", editorAndAbove, updateVideo);


router.delete("/:id", editorAndAbove, deleteVideo);


router.post("/:id/reprocess", editorAndAbove, reprocessVideo);

export default router;
