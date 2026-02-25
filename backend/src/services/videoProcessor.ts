import { Types } from "mongoose";
import { Server as SocketIOServer } from "socket.io";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { InferenceClient } from "@huggingface/inference";
import { Video } from "../models";
import config from "../config";
import { emitProgress, emitComplete, emitError } from "../socket";
import { IVideo } from "../types";

const hf = new InferenceClient(config.huggingFaceToken);

interface SensitivityScores {
  violence: number;
  adult: number;
  language: number;
  drug: number;
}

function extractMetadata(
  filePath: string,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video",
      );
      resolve({
        duration: Math.round(metadata.format.duration ?? 0),
        width: videoStream?.width ?? 1920,
        height: videoStream?.height ?? 1080,
      });
    });
  });
}

async function extractFrames(
  filePath: string,
  duration: number,
  outputDir: string,
): Promise<string[]> {
  const maxFrames = config.maxAnalysisFrames;
  const interval = Math.max(
    config.frameIntervalSeconds,
    Math.floor(duration / maxFrames),
  );

  const timestamps: number[] = [];
  for (
    let t = 1;
    t < duration && timestamps.length < maxFrames;
    t += interval
  ) {
    timestamps.push(t);
  }
  if (timestamps.length === 0 && duration > 0) {
    timestamps.push(Math.floor(duration / 2));
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const framePaths: string[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const outputPath = path.join(outputDir, `frame_${i}.jpg`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .seekInput(timestamps[i])
        .frames(1)
        .outputOptions(["-q:v", "2"])
        .output(outputPath)
        .on("end", () => {
          framePaths.push(outputPath);
          resolve();
        })
        .on("error", reject)
        .run();
    });
  }

  return framePaths;
}

async function generateThumbnail(
  filePath: string,
  outputPath: string,
  seekTime: number = 1,
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .seekInput(seekTime)
      .frames(1)
      .size("320x?")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

async function analyseFrame(framePath: string): Promise<number> {
  const imageBuffer = fs.readFileSync(framePath);
  const blob = new Blob([imageBuffer]);
  const results = await hf.imageClassification({
    model: config.nsfwModel,
    data: blob,
  });

  const nsfwResult = results.find((r) => r.label.toLowerCase() === "nsfw");
  return nsfwResult?.score ?? 0;
}

function cleanupFrames(framePaths: string[], framesDir: string): void {
  for (const fp of framePaths) {
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (err) {
      console.error(`Failed to delete frame: ${fp}`, err);
    }
  }
  try {
    if (fs.existsSync(framesDir) && fs.readdirSync(framesDir).length === 0) {
      fs.rmdirSync(framesDir);
    }
  } catch (err) {
    console.error(`Failed to remove directory: ${framesDir}`, err);
  }
}

export const processVideo = async (
  videoId: Types.ObjectId,
  io: SocketIOServer,
): Promise<void> => {
  let video: IVideo | null = null;
  let framePaths: string[] = [];
  let framesDir = "";

  try {
    video = await Video.findById(videoId);
    if (!video) throw new Error("Video not found");

    const userId = video.uploadedBy.toString();

    // === Stage 1: Validation (0 % → 10 %) ===
    await updateProgress(video, io, userId, 5, "Validating upload…");

    if (!fs.existsSync(video.filepath)) {
      throw new Error("Video file not found on disk");
    }

    await updateProgress(video, io, userId, 10, "Upload validated");

    // === Stage 2: Metadata Extraction (10 % → 30 %) ===
    await updateProgress(
      video,
      io,
      userId,
      15,
      "Extracting metadata with FFmpeg…",
    );

    const metadata = await extractMetadata(video.filepath);
    video.duration = metadata.duration;
    video.resolution = { width: metadata.width, height: metadata.height };

    await updateProgress(video, io, userId, 20, "Metadata extracted");

    // Extract frames for analysis
    framesDir = path.join(config.uploadDir, "frames", videoId.toString());
    await updateProgress(video, io, userId, 25, "Extracting video frames…");

    framePaths = await extractFrames(
      video.filepath,
      metadata.duration,
      framesDir,
    );
    await updateProgress(
      video,
      io,
      userId,
      28,
      `Extracted ${framePaths.length} frame(s)`,
    );

    // Generate thumbnail
    const thumbnailPath = path.join(
      config.uploadDir,
      "thumbnails",
      `${videoId}.jpg`,
    );
    await generateThumbnail(
      video.filepath,
      thumbnailPath,
      Math.min(1, metadata.duration),
    );
    video.thumbnailPath = thumbnailPath;

    await updateProgress(video, io, userId, 30, "Frame extraction complete");

    // === Stage 3: Sensitivity Analysis (30 % → 70 %) ===
    video.processingStatus = config.processingStatus.PROCESSING;
    await video.save();

    await updateProgress(
      video,
      io,
      userId,
      35,
      "Starting NSFW sensitivity analysis (Falconsai/nsfw_image_detection)…",
    );

    const totalFrames = framePaths.length;
    const frameScores: number[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const stageProgress = 35 + Math.round(((i + 1) / totalFrames) * 30);
      await updateProgress(
        video,
        io,
        userId,
        Math.min(stageProgress, 65),
        `Analysing frame ${i + 1}/${totalFrames}…`,
      );

      try {
        const score = await analyseFrame(framePaths[i]);
        frameScores.push(score);
      } catch (err) {
        console.warn(
          `⚠️  Failed to analyse frame ${i + 1}:`,
          err instanceof Error ? err.message : err,
        );
        frameScores.push(0);
      }
    }

    const maxNsfwScore = Math.max(...frameScores, 0);
    const avgNsfwScore =
      frameScores.length > 0
        ? frameScores.reduce((a, b) => a + b, 0) / frameScores.length
        : 0;

    await updateProgress(
      video,
      io,
      userId,
      70,
      "Sensitivity analysis complete",
    );

    // === Stage 4: Classification (70 % → 90 %) ===
    await updateProgress(video, io, userId, 75, "Classifying content…");

    // Map NSFW detection to existing sensitivity detail fields.
    // Only "adult" is populated from the image classifier;
    // violence / language / drug remain 0 (no model for those yet).
    const sensitivityScores: SensitivityScores = {
      violence: 0,
      adult: parseFloat(maxNsfwScore.toFixed(4)),
      language: 0,
      drug: 0,
    };

    const overallScore = sensitivityScores.adult;

    video.sensitivityDetails = sensitivityScores;
    video.sensitivityScore = parseFloat(overallScore.toFixed(4));
    video.sensitivityClassification =
      overallScore > 0.5
        ? config.sensitivityClass.FLAGGED
        : config.sensitivityClass.SAFE;

    await updateProgress(
      video,
      io,
      userId,
      85,
      `Classified as: ${video.sensitivityClassification.toUpperCase()} ` +
        `(NSFW max ${(maxNsfwScore * 100).toFixed(1)}% · avg ${(avgNsfwScore * 100).toFixed(1)}%)`,
    );
    await updateProgress(video, io, userId, 90, "Classification complete");

    // === Stage 5: Finalisation (90 % → 100 %) ===
    await updateProgress(video, io, userId, 95, "Finalising…");

    // Cleanup extracted frames
    cleanupFrames(framePaths, framesDir);

    video.isStreamReady = true;
    video.processingStatus = config.processingStatus.COMPLETED;
    video.processingProgress = 100;
    await video.save();

    // Emit completion
    emitComplete(io, videoId.toString(), userId, {
      status: video.processingStatus,
      progress: 100,
      sensitivityClassification: video.sensitivityClassification,
      sensitivityScore: video.sensitivityScore,
      sensitivityDetails: video.sensitivityDetails,
      message: "Processing complete",
    });

    console.log(
      `✅ Video processed: ${video.title} → ${video.sensitivityClassification} ` +
        `(NSFW max ${(maxNsfwScore * 100).toFixed(1)}%)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Processing failed for video ${videoId}:`, message);

    // Cleanup frames on error
    if (framePaths.length > 0) cleanupFrames(framePaths, framesDir);

    if (video) {
      video.processingStatus = config.processingStatus.FAILED;
      video.processingError = message;
      await video.save();

      emitError(io, videoId.toString(), video.uploadedBy.toString(), message);
    }
  }
};

async function updateProgress(
  video: IVideo,
  io: SocketIOServer,
  userId: string,
  progress: number,
  message: string,
): Promise<void> {
  video.processingStatus = config.processingStatus.PROCESSING;
  video.processingProgress = progress;
  await video.save();

  emitProgress(io, video._id.toString(), userId, {
    status: config.processingStatus.PROCESSING,
    progress,
    message,
  });
}
