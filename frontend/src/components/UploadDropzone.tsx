/**
 * UploadDropzone Component
 * Drag-and-drop video upload with progress indicator.
 */
import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Upload, X, FileVideo, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { videoAPI } from "../services/api";
import type { Video } from "../types";

const ALLOWED_TYPES: string[] = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
];
const MAX_SIZE: number = 500 * 1024 * 1024; // 500MB

interface UploadDropzoneProps {
  onUploadComplete?: (video: Video) => void;
}

export default function UploadDropzone({
  onUploadComplete,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [category, setCategory] = useState<string>("uncategorised");
  const [visibility, setVisibility] = useState<string>("private");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (f: File): boolean => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error("Invalid file type. Please upload a video file.");
      return false;
    }
    if (f.size > MAX_SIZE) {
      toast.error("File too large. Maximum size is 500MB.");
      return false;
    }
    return true;
  };

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && validateFile(droppedFile)) {
        setFile(droppedFile);
        if (!title) setTitle(droppedFile.name.replace(/\.[^/.]+$/, ""));
      }
    },
    [title],
  );

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) {
      setFile(selected);
      if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!file) return void toast.error("Please select a video file.");

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("video", file);
      formData.append("title", title || file.name);
      formData.append("description", description);
      formData.append("tags", tags);
      formData.append("category", category);
      formData.append("visibility", visibility);

      const { data } = await videoAPI.upload(formData, (progressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total ?? 1),
        );
        setUploadProgress(percent);
      });

      toast.success("Video uploaded! Processing started.");
      onUploadComplete?.(data.data.video);

      // Reset form
      setFile(null);
      setTitle("");
      setDescription("");
      setTags("");
      setCategory("uncategorised");
      setUploadProgress(0);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dropzone */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-primary-500 bg-primary-50"
              : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
          }`}
        >
          <Upload
            size={48}
            className={`mx-auto mb-4 ${isDragging ? "text-primary-500" : "text-gray-400"}`}
          />
          <p className="text-lg font-medium text-gray-700 mb-1">
            Drag & drop your video here
          </p>
          <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
          <p className="text-xs text-gray-400">
            MP4, WebM, AVI, MOV, MKV • Max 500MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <FileVideo size={24} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{file.name}</p>
            <p className="text-sm text-gray-500">{formatSize(file.size)}</p>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setTitle("");
              }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Uploading...</span>
            <span className="font-bold text-primary-600">
              {uploadProgress}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Metadata form */}
      {file && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Video title"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder="Optional description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="e.g. training, marketing"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
            >
              <option value="private">Private</option>
              <option value="organisation">Organisation</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>
      )}

      {/* Submit */}
      {file && (
        <button
          type="submit"
          disabled={uploading}
          className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={20} />
              Upload Video
            </>
          )}
        </button>
      )}
    </form>
  );
}
