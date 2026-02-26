/**
 * Video Library Page
 * Comprehensive list of videos with search and filtering.
 */
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { videoAPI } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { usePermissions } from "../rbac";
import VideoCard from "../components/VideoCard";
import {
  Search,
  Filter,
  Loader2,
  Film,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  Video,
  PaginationInfo,
  VideoProgressEvent,
  VideoCompleteEvent,
} from "../types";

interface Filters {
  search: string;
  status: string;
  sensitivity: string;
  sortBy: string;
  sortOrder: string;
}

export default function VideoLibraryPage() {
  const { on } = useSocket();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pages: 1,
    total: 0,
    limit: 12,
  });
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "",
    sensitivity: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const fetchVideos = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, limit: 12 };
        if (filters.search) params.search = filters.search;
        if (filters.status) params.status = filters.status;
        if (filters.sensitivity) params.sensitivity = filters.sensitivity;
        params.sortBy = filters.sortBy;
        params.sortOrder = filters.sortOrder;

        const { data } = await videoAPI.list(params);
        setVideos(data.data.videos);
        setPagination(data.data.pagination);
      } catch {
        toast.error("Failed to load videos.");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Real-time updates
  useEffect(() => {
    const cleanup1 = on("video:progress", (raw: unknown) => {
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
    });

    const cleanup2 = on("video:complete", (raw: unknown) => {
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
    });

    return () => {
      cleanup1();
      cleanup2();
    };
  }, [on]);

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    fetchVideos(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Library</h1>
          <p className="text-gray-500 mt-1">
            {pagination.total} video(s) total
          </p>
        </div>
        {can("video:upload") && (
          <button
            onClick={() => navigate("/upload")}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            Upload Video
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form
          onSubmit={handleSearch}
          className="flex flex-wrap gap-3 items-end"
        >
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Search
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                placeholder="Search by title..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Sensitivity filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Sensitivity
            </label>
            <select
              value={filters.sensitivity}
              onChange={(e) =>
                setFilters({ ...filters, sensitivity: e.target.value })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">All</option>
              <option value="safe">Safe</option>
              <option value="flagged">Flagged</option>
              <option value="unprocessed">Unprocessed</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Sort by
            </label>
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-");
                setFilters({ ...filters, sortBy, sortOrder });
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
              <option value="size-desc">Largest first</option>
              <option value="size-asc">Smallest first</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm flex items-center gap-2 transition-colors"
          >
            <Filter size={14} />
            Apply
          </button>
        </form>
      </div>

      {/* Video grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Film size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No videos found</p>
          <p className="text-gray-400 text-sm mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard key={video._id} video={video} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchVideos(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600 px-4">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => fetchVideos(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
