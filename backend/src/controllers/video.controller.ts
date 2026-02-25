import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { Video } from "../models";
import config from "../config";
import { processVideo } from "../services/videoProcessor";
import { IUser, IVideo } from "../types";

export const uploadVideo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { title, description, tags, category, visibility } = req.body;

    const video = await Video.create({
      title: title || req.file!.originalname,
      description: description || "",
      originalName: req.file!.originalname,
      filename: req.file!.filename,
      filepath: req.file!.path,
      mimeType: req.file!.mimetype,
      size: req.file!.size,
      uploadedBy: req.user!._id,
      organisation: req.user!.organisation,
      tags: tags
        ? (tags as string).split(",").map((t: string) => t.trim())
        : [],
      category: category || "uncategorised",
      visibility: visibility || "private",
    });

    const io = req.app.get("io");
    processVideo(video._id, io);

    res.status(201).json({
      success: true,
      message: "Video uploaded successfully. Processing started.",
      data: { video },
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

export const listVideos = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const status = req.query.status as string | undefined;
    const sensitivity = req.query.sensitivity as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    const filter: Record<string, unknown> = {};

    if (req.user!.role === config.roles.ADMIN) {
      filter.organisation = req.user!.organisation;
    } else if (req.user!.role === config.roles.EDITOR) {
      filter.$or = [
        { uploadedBy: req.user!._id },
        {
          organisation: req.user!.organisation,
          visibility: { $in: ["organisation", "public"] },
        },
      ];
    } else {
      filter.organisation = req.user!.organisation;
      filter.visibility = { $in: ["organisation", "public"] };
    }

    if (status) filter.processingStatus = status;
    if (sensitivity) filter.sensitivityClassification = sensitivity;
    if (category) filter.category = category;
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const videos = await Video.find(filter)
      .populate("uploadedBy", "name email")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Video.countDocuments(filter);

    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getVideo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id).populate(
      "uploadedBy",
      "name email",
    );
    if (!video) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }

    if (!canAccessVideo(req.user!, video)) {
      res.status(403).json({ success: false, message: "Access denied." });
      return;
    }

    res.json({ success: true, data: { video } });
  } catch (error) {
    next(error);
  }
};

export const streamVideo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }

    if (!canAccessVideo(req.user!, video)) {
      res.status(403).json({ success: false, message: "Access denied." });
      return;
    }

    const videoPath = video.filepath;

    if (!fs.existsSync(videoPath)) {
      res
        .status(404)
        .json({ success: false, message: "Video file not found on server." });
      return;
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": video.mimeType,
      });

      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": video.mimeType,
      });

      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    next(error);
  }
};

export const updateVideo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }

    if (
      video.uploadedBy.toString() !== req.user!._id.toString() &&
      req.user!.role !== config.roles.ADMIN
    ) {
      res.status(403).json({ success: false, message: "Access denied." });
      return;
    }

    const { title, description, tags, category, visibility } = req.body;
    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (tags)
      video.tags = (tags as string).split(",").map((t: string) => t.trim());
    if (category) video.category = category;
    if (visibility) video.visibility = visibility;

    await video.save();

    res.json({ success: true, message: "Video updated.", data: { video } });
  } catch (error) {
    next(error);
  }
};

export const deleteVideo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }

    if (
      video.uploadedBy.toString() !== req.user!._id.toString() &&
      req.user!.role !== config.roles.ADMIN
    ) {
      res.status(403).json({ success: false, message: "Access denied." });
      return;
    }

    if (fs.existsSync(video.filepath)) {
      fs.unlinkSync(video.filepath);
    }
    if (video.thumbnailPath && fs.existsSync(video.thumbnailPath)) {
      fs.unlinkSync(video.thumbnailPath);
    }

    await Video.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Video deleted." });
  } catch (error) {
    next(error);
  }
};

export const reprocessVideo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ success: false, message: "Video not found." });
      return;
    }

    video.processingStatus = config.processingStatus.PENDING;
    video.processingProgress = 0;
    video.processingError = null;
    video.sensitivityClassification = config.sensitivityClass.UNPROCESSED;
    video.sensitivityScore = null;
    await video.save();

    const io = req.app.get("io");
    processVideo(video._id, io);

    res.json({
      success: true,
      message: "Reprocessing started.",
      data: { video },
    });
  } catch (error) {
    next(error);
  }
};

function canAccessVideo(user: IUser, video: IVideo): boolean {
  if (
    user.role === config.roles.ADMIN &&
    user.organisation === video.organisation
  ) {
    return true;
  }

  if (video.uploadedBy.toString() === user._id.toString()) {
    return true;
  }

  if (user.organisation === video.organisation) {
    if (video.visibility === "organisation" || video.visibility === "public") {
      return true;
    }
  }

  if (video.visibility === "public") {
    return true;
  }
  return false;
}
