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
  adult: number;
  language: number;
}

/** Per-frame score from NSFW model */
interface FrameAnalysisResult {
  adult: number;
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
  fs.mkdirSync(outputDir, { recursive: true });

  // --- 1. Denser regular-interval sampling ---
  let interval: number;
  if (duration <= 15) {
    interval = 1;
  } else if (duration <= 30) {
    interval = 2;
  } else if (duration <= 120) {
    interval = 3;
  } else if (duration <= 600) {
    interval = 4;
  } else if (duration <= 1800) {
    interval = 6;
  } else {
    interval = 8;
  }

  const regularTimestamps: number[] = [];
  for (let t = 0.5; t < duration; t += interval) {
    regularTimestamps.push(parseFloat(t.toFixed(2)));
  }
  if (regularTimestamps.length === 0 && duration > 0) {
    regularTimestamps.push(Math.floor(duration / 2));
  }

  // --- 2. Scene-change detection via ffmpeg ---
  const sceneTimestamps = await detectSceneChanges(filePath, duration);

  // --- 3. Merge & deduplicate (drop scene-change timestamps within 0.5 s of a regular one) ---
  const allTimestamps = [...regularTimestamps];
  for (const st of sceneTimestamps) {
    const tooClose = allTimestamps.some((rt) => Math.abs(rt - st) < 0.5);
    if (!tooClose) {
      allTimestamps.push(st);
    }
  }
  allTimestamps.sort((a, b) => a - b);

  console.log(
    `📸 Frame extraction: ${regularTimestamps.length} regular + ${sceneTimestamps.length} scene-change ` +
      `→ ${allTimestamps.length} unique timestamps for ${duration}s video`,
  );

  // --- 4. Extract every frame (skip individual failures) ---
  const framePaths: string[] = [];

  for (let i = 0; i < allTimestamps.length; i++) {
    const outputPath = path.join(outputDir, `frame_${i}.jpg`);
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(filePath)
          .seekInput(allTimestamps[i])
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
    } catch (err) {
      console.warn(
        `⚠️  Failed to extract frame at ${allTimestamps[i]}s, skipping:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (framePaths.length === 0) {
    console.warn(
      "⚠️  No frames could be extracted – falling back to single frame at t=0",
    );
    const fallbackPath = path.join(outputDir, "frame_fallback.jpg");
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .frames(1)
        .outputOptions(["-q:v", "2"])
        .output(fallbackPath)
        .on("end", () => {
          framePaths.push(fallbackPath);
          resolve();
        })
        .on("error", (fbErr) => {
          console.warn(
            "⚠️  Fallback frame extraction also failed:",
            fbErr.message,
          );
          resolve(); // continue with 0 frames
        })
        .run();
    });
  }

  return framePaths;
}

/**
 * Use ffmpeg's scene-change filter to find timestamps where significant
 * visual transitions occur. These are the most likely places for brief
 * violent / adult content that fixed-interval sampling would miss.
 */
function detectSceneChanges(
  filePath: string,
  duration: number,
): Promise<number[]> {
  // Sensitivity threshold: lower = more scenes detected.
  // 0.3 is a good balance between catching real cuts and avoiding noise.
  const threshold = 0.3;

  return new Promise((resolve) => {
    const timestamps: number[] = [];
    let stderr = "";

    const nullOutput = process.platform === "win32" ? "NUL" : "/dev/null";

    const cmd = ffmpeg(filePath)
      .videoFilters(`select='gt(scene,${threshold})',showinfo`)
      .outputOptions(["-vsync", "vfr"])
      .outputFormat("null")
      .output(nullOutput);

    cmd.on("stderr", (line: string) => {
      stderr += line + "\n";
      // showinfo filter prints lines like: pts_time:12.345
      const match = line.match(/pts_time:\s*([\d.]+)/);
      if (match) {
        const t = parseFloat(match[1]);
        if (t > 0 && t < duration) {
          timestamps.push(parseFloat(t.toFixed(2)));
        }
      }
    });

    cmd.on("end", () => resolve(timestamps));

    // If scene detection fails (e.g. very short clip), just return empty
    cmd.on("error", (err: Error) => {
      console.warn("Scene detection failed, continuing without:", err.message);
      resolve([]);
    });

    cmd.run();
  });
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

/**
 * Analyse a single frame for adult/NSFW content using Falconsai model.
 */
async function analyseFrameAdult(framePath: string): Promise<number> {
  const imageBuffer = fs.readFileSync(framePath);
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });
  const results = await hf.imageClassification({
    model: config.nsfwModel,
    data: blob,
    provider: "hf-inference",
  });

  const nsfwResult = results.find((r) => r.label.toLowerCase() === "nsfw");
  return nsfwResult?.score ?? 0;
}

/**
 * Analyse a single frame for adult/NSFW content.
 */
async function analyseFrame(framePath: string): Promise<FrameAnalysisResult> {
  const adult = await analyseFrameAdult(framePath);
  return { adult };
}

/**
 * Extract audio track from video as a WAV file for speech analysis.
 */
function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .outputFormat("wav")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => {
        // Some videos have no audio track or unsupported audio — that's fine
        if (
          err.message.includes("does not contain any stream") ||
          err.message.includes("no audio") ||
          err.message.includes("Conversion failed") ||
          err.message.includes("Invalid data")
        ) {
          console.warn("⚠️  Audio extraction skipped:", err.message);
          resolve();
        } else {
          reject(err);
        }
      })
      .run();
  });
}

// Common profanity / offensive words for language scoring
const PROFANITY_LIST: string[] = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "damn",
  "hell",
  "bastard",
  "dick",
  "piss",
  "crap",
  "cock",
  "cunt",
  "slut",
  "whore",
  "nigger",
  "nigga",
  "fag",
  "faggot",
  "retard",
  "motherfucker",
  "asshole",
  "dumbass",
  "bullshit",
  "goddamn",
  "wtf",
  "stfu",
  "lmao",
  "porn",
  "nude",
  "naked",
];

/**
 * Transcribe audio using Whisper and score for profanity.
 * Returns a 0-1 score based on the density of profane words.
 */
async function analyseLanguage(audioPath: string): Promise<number> {
  if (!fs.existsSync(audioPath)) return 0;

  const audioBuffer = fs.readFileSync(audioPath);
  if (audioBuffer.length < 1000) return 0; // too small = silence

  const blob = new Blob([audioBuffer], { type: "audio/wav" });

  try {
    const result = await hf.automaticSpeechRecognition({
      model: config.whisperModel,
      data: blob,
      provider: "hf-inference",
    });

    const transcript = (result.text || "").toLowerCase();
    if (!transcript.trim()) return 0;

    const words = transcript.split(/\s+/);
    const totalWords = words.length;
    if (totalWords === 0) return 0;

    let profaneCount = 0;
    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, "");
      if (PROFANITY_LIST.some((p) => cleaned.includes(p))) {
        profaneCount++;
      }
    }

    // Score: ratio of profane words, capped at 1.0
    // Multiply by 3 so even moderate profanity registers clearly
    const rawScore = (profaneCount / totalWords) * 3;
    return Math.min(parseFloat(rawScore.toFixed(4)), 1);
  } catch (err) {
    console.warn(
      "⚠️  Language analysis failed:",
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
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
    try {
      await generateThumbnail(
        video.filepath,
        thumbnailPath,
        Math.min(1, metadata.duration),
      );
      video.thumbnailPath = thumbnailPath;
    } catch (err) {
      console.warn(
        "⚠️  Thumbnail generation failed, continuing without:",
        err instanceof Error ? err.message : err,
      );
    }

    await updateProgress(video, io, userId, 30, "Frame extraction complete");

    // === Stage 3: Sensitivity Analysis (30 % → 75 %) ===
    video.processingStatus = config.processingStatus.PROCESSING;
    await video.save();

    // --- 3a. Frame-based analysis: Adult / NSFW (30 % → 60 %) ---
    await updateProgress(
      video,
      io,
      userId,
      32,
      "Starting visual sensitivity analysis (NSFW)…",
    );

    const totalFrames = framePaths.length;
    const frameResults: FrameAnalysisResult[] = [];
    const BATCH_SIZE = 4; // 1 API call per frame (NSFW)

    for (
      let batchStart = 0;
      batchStart < totalFrames;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalFrames);
      const batch = framePaths.slice(batchStart, batchEnd);

      const stageProgress = 32 + Math.round((batchEnd / totalFrames) * 28);
      await updateProgress(
        video,
        io,
        userId,
        Math.min(stageProgress, 58),
        `Analysing frames ${batchStart + 1}–${batchEnd}/${totalFrames} (adult / NSFW)…`,
      );

      const batchResults = await Promise.allSettled(
        batch.map((fp) => analyseFrame(fp)),
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          frameResults.push(result.value);
        } else {
          console.warn(
            `⚠️  Failed to analyse frame ${batchStart + j + 1}:`,
            result.reason instanceof Error
              ? result.reason.message
              : result.reason,
          );
          frameResults.push({ adult: 0 });
        }
      }
    }

    await updateProgress(video, io, userId, 60, "Visual analysis complete");

    // --- 3b. Language / profanity analysis via Whisper (60 % → 75 %) ---
    await updateProgress(
      video,
      io,
      userId,
      62,
      "Extracting audio for language analysis (Whisper)…",
    );

    const audioPath = path.join(
      config.uploadDir,
      "frames",
      videoId.toString(),
      "audio.wav",
    );
    let languageScore = 0;

    try {
      await extractAudio(video.filepath, audioPath);
      await updateProgress(
        video,
        io,
        userId,
        66,
        "Transcribing audio for profanity detection…",
      );
      languageScore = await analyseLanguage(audioPath);

      // Clean up audio file
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (err) {
      console.warn(
        "⚠️  Audio/language analysis failed, skipping:",
        err instanceof Error ? err.message : err,
      );
    }

    await updateProgress(
      video,
      io,
      userId,
      75,
      "All sensitivity analysis complete",
    );

    // === Stage 4: Classification (75 % → 90 %) ===
    await updateProgress(video, io, userId, 77, "Classifying content…");

    // Compute per-category scores from frame results
    const adultScores = frameResults.map((r) => r.adult);

    const computeCategoryScore = (
      scores: number[],
    ): { max: number; weighted: number } => {
      if (scores.length === 0) return { max: 0, weighted: 0 };
      const max = Math.max(...scores);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const sorted = [...scores].sort((a, b) => b - a);
      const top5 = sorted.slice(0, Math.min(5, sorted.length));
      const top5Avg = top5.reduce((a, b) => a + b, 0) / top5.length;
      // Weighted: 60% max + 25% top-5 avg + 15% overall avg
      const weighted = max * 0.6 + top5Avg * 0.25 + avg * 0.15;
      return { max, weighted };
    };

    const adultStats = computeCategoryScore(adultScores);

    const sensitivityScores: SensitivityScores = {
      adult: parseFloat(adultStats.weighted.toFixed(4)),
      language: parseFloat(languageScore.toFixed(4)),
    };

    // Overall score: highest category score drives the classification
    const overallScore = parseFloat(
      Math.max(sensitivityScores.adult, sensitivityScores.language).toFixed(4),
    );

    video.sensitivityDetails = sensitivityScores;
    video.sensitivityScore = overallScore;

    // Flag if ANY category is concerning
    const adultFlagged =
      adultStats.weighted > 0.4 ||
      adultStats.max > 0.7 ||
      adultScores.filter((s) => s > 0.4).length >= 2;
    const languageFlagged = languageScore > 0.15;

    video.sensitivityClassification =
      adultFlagged || languageFlagged
        ? config.sensitivityClass.FLAGGED
        : config.sensitivityClass.SAFE;

    const flagReasons: string[] = [];
    if (adultFlagged)
      flagReasons.push(`Adult ${(adultStats.weighted * 100).toFixed(1)}%`);
    if (languageFlagged)
      flagReasons.push(`Language ${(languageScore * 100).toFixed(1)}%`);

    const detailMsg =
      flagReasons.length > 0
        ? flagReasons.join(" · ")
        : `All clear (max ${(overallScore * 100).toFixed(1)}%)`;

    await updateProgress(
      video,
      io,
      userId,
      85,
      `Classified as: ${video.sensitivityClassification.toUpperCase()} — ${detailMsg}`,
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
      `✅ Video processed: ${video.title} → ${video.sensitivityClassification} — ${detailMsg}`,
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
