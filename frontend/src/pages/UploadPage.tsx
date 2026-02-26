/**
 * Upload Page
 * Video upload interface with drag-and-drop support.
 */
import { useNavigate } from "react-router-dom";
import UploadDropzone from "../components/UploadDropzone";
import type { Video } from "../types";

export default function UploadPage() {
  const navigate = useNavigate();

  const handleUploadComplete = (video: Video): void => {
    // Navigate to the video's detail page to watch processing
    setTimeout(() => {
      navigate(`/video/${video._id}`);
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Video</h1>
        <p className="text-gray-500 mt-1">
          Upload a video for sensitivity analysis. Processing will begin
          automatically.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm">
        <UploadDropzone onUploadComplete={handleUploadComplete} />
      </div>
    </div>
  );
}
