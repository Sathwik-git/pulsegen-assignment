/**
 * Video Player Page
 * Detailed video view with streaming player, processing status, and sensitivity info.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { videoAPI } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { usePermissions, RoleGuard } from "../rbac";
import ProgressTracker from "../components/ProgressTracker";
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileVideo,
  Calendar,
  HardDrive,
  Tag,
  Eye,
  Edit,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  Video,
  VideoProgressEvent,
  VideoCompleteEvent,
  VideoErrorEvent,
  Visibility,
} from "../types";

interface EditForm {
  title: string;
  description: string;
  tags: string;
  category: string;
  visibility: string;
}

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can, isAdmin } = usePermissions();
  const { on, subscribeToVideo, unsubscribeFromVideo } = useSocket();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editing, setEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    description: "",
    tags: "",
    category: "",
    visibility: "",
  });
  const [progressMessage, setProgressMessage] = useState<string>("");

  const fetchVideo = useCallback(async () => {
    try {
      const { data } = await videoAPI.get(id!);
      setVideo(data.data.video);
      setEditForm({
        title: data.data.video.title,
        description: data.data.video.description || "",
        tags: (data.data.video.tags || []).join(", "),
        category: data.data.video.category || "",
        visibility: data.data.video.visibility || "private",
      });
    } catch {
      toast.error("Video not found.");
      navigate("/library");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchVideo();
    subscribeToVideo(id!);
    return () => unsubscribeFromVideo(id!);
  }, [id, fetchVideo, subscribeToVideo, unsubscribeFromVideo]);

  // Real-time updates
  useEffect(() => {
    const cleanup1 = on("video:progress", (raw: unknown) => {
      const data = raw as VideoProgressEvent;
      if (data.videoId === id) {
        setVideo((prev) =>
          prev
            ? {
                ...prev,
                processingProgress: data.progress,
                processingStatus: data.status,
              }
            : prev,
        );
        setProgressMessage(data.message || "");
      }
    });

    const cleanup2 = on("video:complete", (raw: unknown) => {
      const data = raw as VideoCompleteEvent;
      if (data.videoId === id) {
        setVideo((prev) =>
          prev
            ? {
                ...prev,
                processingStatus: "completed",
                processingProgress: 100,
                sensitivityClassification: data.sensitivityClassification,
                sensitivityScore: data.sensitivityScore,
                sensitivityDetails: data.sensitivityDetails,
                isStreamReady: true,
              }
            : prev,
        );
        setProgressMessage("Processing complete");
        toast.success("Video processing complete!");
      }
    });

    const cleanup3 = on("video:error", (raw: unknown) => {
      const data = raw as VideoErrorEvent;
      if (data.videoId === id) {
        setVideo((prev) =>
          prev ? { ...prev, processingStatus: "failed" } : prev,
        );
        setProgressMessage(data.error);
      }
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
    };
  }, [id, on]);

  const handleDelete = async (): Promise<void> => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await videoAPI.delete(id!);
      toast.success("Video deleted.");
      navigate("/library");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || "Delete failed.");
    }
  };

  const handleReprocess = async (): Promise<void> => {
    try {
      await videoAPI.reprocess(id!);
      toast.success("Reprocessing started.");
      fetchVideo();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || "Reprocess failed.");
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags,
        category: editForm.category,
        visibility: editForm.visibility as Visibility,
      };
      await videoAPI.update(id!, payload);
      toast.success("Video updated.");
      setEditing(false);
      fetchVideo();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || "Update failed.");
    }
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!video) return null;

  const isOwnerOrAdmin = video.uploadedBy?._id === user?.id || isAdmin;
  const canEdit = can("video:edit");
  const canDelete = can("video:delete") && isOwnerOrAdmin;
  const canReprocess = can("video:reprocess");

  // Build the token-authenticated stream URL
  const streamUrl = videoAPI.streamUrl(id!);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          {editing ? (
            <input
              type="text"
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
              className="text-2xl font-bold text-gray-900 border-b-2 border-primary-500 outline-none bg-transparent w-full"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  title="Edit"
                >
                  <Edit size={18} />
                </button>
                {canReprocess && (
                  <button
                    onClick={handleReprocess}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    title="Reprocess"
                  >
                    <RefreshCw size={18} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video player or processing */}
          {video.processingStatus === "completed" && video.isStreamReady ? (
            <div className="bg-black rounded-xl overflow-hidden aspect-video">
              <video
                controls
                className="w-full h-full"
                src={streamUrl}
                poster={
                  video._id ? videoAPI.thumbnailUrl(video._id) : undefined
                }
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <ProgressTracker
                progress={video.processingProgress || 0}
                status={video.processingStatus}
                message={progressMessage || video.processingError || ""}
              />
            </div>
          )}

          {/* Description */}
          {editing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              />
            </div>
          ) : (
            video.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Description
                </h3>
                <p className="text-gray-700">{video.description}</p>
              </div>
            )
          )}

          {/* Edit fields */}
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-xl border border-gray-200 p-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tags: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) =>
                    setEditForm({ ...editForm, category: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={editForm.visibility}
                  onChange={(e) =>
                    setEditForm({ ...editForm, visibility: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="private">Private</option>
                  <option value="organisation">Organisation</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Sensitivity classification */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Shield size={16} />
              Sensitivity Analysis
            </h3>
            {video.sensitivityClassification === "safe" && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg mb-3">
                <CheckCircle size={24} className="text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Safe Content</p>
                  <p className="text-sm text-green-600">
                    Score:{" "}
                    {((1 - (video.sensitivityScore || 0)) * 100).toFixed(1)}%
                    safe
                  </p>
                </div>
              </div>
            )}
            {video.sensitivityClassification === "flagged" && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg mb-3">
                <AlertTriangle size={24} className="text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">Flagged Content</p>
                  <p className="text-sm text-red-600">
                    Score: {((video.sensitivityScore || 0) * 100).toFixed(1)}%
                    sensitivity
                  </p>
                </div>
              </div>
            )}
            {video.sensitivityClassification === "unprocessed" && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-3">
                <Clock size={24} className="text-gray-400" />
                <p className="text-gray-500">Not yet analysed</p>
              </div>
            )}

            {/* Detail scores */}
            {video.sensitivityDetails &&
              video.sensitivityClassification !== "unprocessed" && (
                <div className="space-y-3 mt-4">
                  {(
                    [
                      {
                        label: "Adult / NSFW",
                        value: video.sensitivityDetails.adult,
                      },
                      {
                        label: "Language",
                        value: video.sensitivityDetails.language,
                      },
                    ] as { label: string; value: number }[]
                  ).map(({ label, value }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-medium">
                          {((value || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (value || 0) > 0.5
                              ? "bg-red-500"
                              : (value || 0) > 0.25
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                          style={{
                            width: `${Math.max((value || 0) * 100, 2)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Video metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              Video Details
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <FileVideo size={16} className="text-gray-400" />
                <span className="text-gray-600">{video.originalName}</span>
              </div>
              <div className="flex items-center gap-3">
                <HardDrive size={16} className="text-gray-400" />
                <span className="text-gray-600">{formatSize(video.size)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-400" />
                <span className="text-gray-600">
                  {new Date(video.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Eye size={16} className="text-gray-400" />
                <span className="text-gray-600 capitalize">
                  {video.visibility}
                </span>
              </div>
              {video.tags && video.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag size={16} className="text-gray-400 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {video.uploadedBy && (
                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {video.uploadedBy.name?.charAt(0)}
                  </div>
                  <span className="text-gray-600">{video.uploadedBy.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
