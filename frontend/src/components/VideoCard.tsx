/**
 * VideoCard Component
 * Displays a video thumbnail/preview with status information.
 */
import { useNavigate } from "react-router-dom";
import {
  Play,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type {
  Video,
  ProcessingStatus,
  SensitivityClassification,
} from "../types";
import { videoAPI } from "../services/api";

interface StatusConfigEntry {
  icon: LucideIcon;
  label: string;
  color: string;
  badge: string;
  animate?: boolean;
}

interface SensitivityConfigEntry {
  label: string;
  color: string;
  icon: LucideIcon;
}

const statusConfig: Record<ProcessingStatus, StatusConfigEntry> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-yellow-600 bg-yellow-50",
    badge: "bg-yellow-100 text-yellow-700",
  },
  processing: {
    icon: Loader2,
    label: "Processing",
    color: "text-blue-600 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    animate: true,
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "text-green-600 bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-600 bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
};

const sensitivityConfig: Record<
  SensitivityClassification,
  SensitivityConfigEntry
> = {
  safe: {
    label: "Safe",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  flagged: {
    label: "Flagged",
    color: "bg-red-100 text-red-700",
    icon: AlertTriangle,
  },
  unprocessed: {
    label: "Unprocessed",
    color: "bg-gray-100 text-gray-600",
    icon: Clock,
  },
};

interface VideoCardProps {
  video: Video;
}

export default function VideoCard({ video }: VideoCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[video.processingStatus] || statusConfig.pending;
  const sensitivity =
    sensitivityConfig[video.sensitivityClassification] ||
    sensitivityConfig.unprocessed;
  const StatusIcon = status.icon;
  const SensitivityIcon = sensitivity.icon;

  const formatSize = (bytes: number): string => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
      onClick={() => navigate(`/video/${video._id}`)}
    >
      {/* Thumbnail / Status area */}
      <div
        className="relative h-40 bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden bg-cover bg-center"
        style={
          video.processingStatus === "completed" && video.thumbnailPath
            ? { backgroundImage: `url(${videoAPI.thumbnailUrl(video._id)})` }
            : undefined
        }
      >
        {video.processingStatus === "completed" ? (
          <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
            <Play size={24} className="text-primary-600 ml-1" />
          </div>
        ) : (
          <StatusIcon
            size={36}
            className={`${status.color.split(" ")[0]} ${status.animate ? "animate-spin" : ""}`}
          />
        )}

        {/* Progress bar for processing */}
        {video.processingStatus === "processing" && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all duration-300 animate-progress-pulse"
              style={{ width: `${video.processingProgress || 0}%` }}
            />
          </div>
        )}

        {/* Sensitivity badge */}
        {video.sensitivityClassification !== "unprocessed" && (
          <span
            className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${sensitivity.color}`}
          >
            <SensitivityIcon size={12} />
            {sensitivity.label}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate mb-1">
          {video.title}
        </h3>
        <p className="text-xs text-gray-500 truncate mb-3">
          {video.description || "No description"}
        </p>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${status.badge}`}
          >
            {status.label}
            {video.processingStatus === "processing" &&
              ` ${video.processingProgress || 0}%`}
          </span>
          <span>{formatSize(video.size)}</span>
          <span>{formatDate(video.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
