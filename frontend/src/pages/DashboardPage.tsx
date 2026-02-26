/**
 * Dashboard Page
 * Shows real-time overview of video processing and recent activity.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { videoAPI } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { usePermissions, RoleGuard } from "../rbac";
import VideoCard from "../components/VideoCard";
import ProgressTracker from "../components/ProgressTracker";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  Film,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  Video,
  VideoProgressEvent,
  VideoCompleteEvent,
  VideoErrorEvent,
} from "../types";

interface DashboardStats {
  total: number;
  processing: number;
  safe: number;
  flagged: number;
}

interface StatCard {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { on } = useSocket();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    processing: 0,
    safe: 0,
    flagged: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [processsingVideos, setProcessingVideos] = useState<Video[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await videoAPI.list({
        limit: 50,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      const all = data.data.videos;
      setVideos(all);

      setStats({
        total: all.length,
        processing: all.filter(
          (v) =>
            v.processingStatus === "processing" ||
            v.processingStatus === "pending",
        ).length,
        safe: all.filter((v) => v.sensitivityClassification === "safe").length,
        flagged: all.filter((v) => v.sensitivityClassification === "flagged")
          .length,
      });

      setProcessingVideos(
        all.filter(
          (v) =>
            v.processingStatus === "processing" ||
            v.processingStatus === "pending",
        ),
      );
    } catch {
      toast.error("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time updates
  useEffect(() => {
    const cleanupProgress = on("video:progress", (raw: unknown) => {
      const data = raw as VideoProgressEvent;
      setVideos((prev) =>
        prev.map((v) =>
          v._id === data.videoId
            ? {
                ...v,
                processingProgress: data.progress,
                processingStatus: data.status,
              }
            : v,
        ),
      );
      setProcessingVideos((prev) =>
        prev.map((v) =>
          v._id === data.videoId
            ? {
                ...v,
                processingProgress: data.progress,
                processingStatus: data.status,
                _message: data.message,
              }
            : v,
        ),
      );
    });

    const cleanupComplete = on("video:complete", (raw: unknown) => {
      const data = raw as VideoCompleteEvent;
      setVideos((prev) =>
        prev.map((v) =>
          v._id === data.videoId
            ? {
                ...v,
                processingStatus: "completed" as const,
                processingProgress: 100,
                sensitivityClassification: data.sensitivityClassification,
              }
            : v,
        ),
      );
      setProcessingVideos((prev) => prev.filter((v) => v._id !== data.videoId));
      setStats((prev) => ({
        ...prev,
        processing: Math.max(0, prev.processing - 1),
        ...(data.sensitivityClassification === "safe"
          ? { safe: prev.safe + 1 }
          : { flagged: prev.flagged + 1 }),
      }));
      toast.success(`Video processed: ${data.sensitivityClassification}`);
    });

    const cleanupError = on("video:error", (raw: unknown) => {
      const data = raw as VideoErrorEvent;
      setProcessingVideos((prev) =>
        prev.map((v) =>
          v._id === data.videoId
            ? {
                ...v,
                processingStatus: "failed" as const,
                _message: data.error,
              }
            : v,
        ),
      );
    });

    return () => {
      cleanupProgress();
      cleanupComplete();
      cleanupError();
    };
  }, [on]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  const statCards: StatCard[] = [
    {
      label: "Total Videos",
      value: stats.total,
      icon: Film,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Processing",
      value: stats.processing,
      icon: Loader2,
      color: "bg-yellow-50 text-yellow-600",
    },
    {
      label: "Safe",
      value: stats.safe,
      icon: CheckCircle,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Flagged",
      value: stats.flagged,
      icon: AlertTriangle,
      color: "bg-red-50 text-red-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {can("video:upload") && (
            <button
              onClick={() => navigate("/upload")}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Upload size={16} />
              Upload Video
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}
            >
              <stat.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Active processing */}
      {processsingVideos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <Clock size={18} className="inline mr-2 text-yellow-600" />
            Currently Processing ({processsingVideos.length})
          </h2>
          <div className="space-y-4">
            {processsingVideos.map((video) => (
              <div
                key={video._id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <h3 className="font-semibold text-gray-900 mb-3">
                  {video.title}
                </h3>
                <ProgressTracker
                  progress={video.processingProgress || 0}
                  status={video.processingStatus}
                  message={video._message || ""}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent videos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Videos</h2>
          <button
            onClick={() => navigate("/library")}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all →
          </button>
        </div>
        {videos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Film size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              No videos yet. Upload your first video!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.slice(0, 8).map((video) => (
              <VideoCard key={video._id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
