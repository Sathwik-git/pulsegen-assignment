/**
 * ProgressTracker Component
 * Real-time processing status and progress display.
 */
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import type { ProcessingStatus } from "../types";

interface Stage {
  min: number;
  max: number;
  label: string;
}

const stages: Stage[] = [
  { min: 0, max: 10, label: "Validating upload" },
  { min: 10, max: 30, label: "Extracting metadata" },
  { min: 30, max: 70, label: "Sensitivity analysis" },
  { min: 70, max: 90, label: "Classifying content" },
  { min: 90, max: 100, label: "Preparing for streaming" },
];

interface ProgressTrackerProps {
  progress?: number;
  status?: ProcessingStatus | "pending";
  message?: string;
}

export default function ProgressTracker({
  progress = 0,
  status = "pending",
  message = "",
}: ProgressTrackerProps) {
  const currentStageIndex = stages.findIndex(
    (s) => progress >= s.min && progress < s.max,
  );
  const activeStage =
    currentStageIndex >= 0 ? currentStageIndex : stages.length - 1;

  if (status === "completed") {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <CheckCircle size={24} className="text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">Processing Complete</p>
          <p className="text-sm text-green-600">Video is ready for streaming</p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <XCircle size={24} className="text-red-600 shrink-0" />
        <div>
          <p className="font-semibold text-red-800">Processing Failed</p>
          <p className="text-sm text-red-600">
            {message || "An error occurred during processing"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {status === "pending"
              ? "Waiting to process..."
              : message || "Processing..."}
          </span>
          <span className="text-sm font-bold text-primary-600">
            {progress}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const isComplete = progress >= stage.max;
          const isActive = i === activeStage && status === "processing";

          return (
            <div
              key={i}
              className={`flex items-center gap-3 py-1.5 px-3 rounded-lg transition-colors ${
                isActive ? "bg-primary-50" : ""
              }`}
            >
              {isComplete ? (
                <CheckCircle size={16} className="text-green-500 shrink-0" />
              ) : isActive ? (
                <Loader2
                  size={16}
                  className="text-primary-600 animate-spin shrink-0"
                />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <span
                className={`text-sm ${
                  isComplete
                    ? "text-green-700 font-medium"
                    : isActive
                      ? "text-primary-700 font-medium"
                      : "text-gray-400"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
