import mongoose, { Schema } from "mongoose";
import config from "../config";
import { IVideo } from "../types";

const videoSchema = new Schema<IVideo>(
  {
    title: {
      type: String,
      required: [true, "Video title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: "",
    },
    originalName: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
      unique: true,
    },
    filepath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      default: null,
    },
    resolution: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },

    // Processing pipeline
    processingStatus: {
      type: String,
      enum: Object.values(config.processingStatus),
      default: config.processingStatus.PENDING,
    },
    processingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    processingError: {
      type: String,
      default: null,
    },

    // Sensitivity analysis
    sensitivityClassification: {
      type: String,
      enum: Object.values(config.sensitivityClass),
      default: config.sensitivityClass.UNPROCESSED,
    },
    sensitivityScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    sensitivityDetails: {
      violence: { type: Number, default: 0 },
      adult: { type: Number, default: 0 },
      language: { type: Number, default: 0 },
      drug: { type: Number, default: 0 },
    },

    // Access & ownership
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organisation: {
      type: String,
      required: true,
    },
    visibility: {
      type: String,
      enum: ["private", "organisation", "public"],
      default: "private",
    },

    // Custom categorisation
    tags: [{ type: String, trim: true }],
    category: {
      type: String,
      trim: true,
      default: "uncategorised",
    },

    // Streaming metadata
    isStreamReady: {
      type: Boolean,
      default: false,
    },
    thumbnailPath: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for efficient querying
videoSchema.index({ uploadedBy: 1, createdAt: -1 });
videoSchema.index({ organisation: 1 });
videoSchema.index({ processingStatus: 1 });
videoSchema.index({ sensitivityClassification: 1 });
videoSchema.index({ tags: 1 });

// Virtual: formatted file size
videoSchema.virtual("formattedSize").get(function (this: IVideo) {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (this.size === 0) return "0 Bytes";
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return `${(this.size / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
});

export default mongoose.model<IVideo>("Video", videoSchema);
