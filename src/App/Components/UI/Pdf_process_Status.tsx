import React from "react";
import { FiUpload, FiSettings, FiCheck } from "react-icons/fi";

interface UploadProgress {
  stage: "uploading" | "processing" | "complete";
  progress: number;
  message: string;
}

interface UploadProgressProps {
  progress: UploadProgress;
}

// Icons for different stages
const UploadProgress: React.FC<UploadProgressProps> = ({ progress }) => {
  const getStageIcon = (stage: string) => {
    switch (stage) {
      case "uploading":
        return <FiUpload className="w-6 h-6" />;
      case "processing":
        return <FiSettings className="w-6 h-6" />;
      case "complete":
        return <FiCheck className="w-6 h-6" />;
      default:
        return <FiUpload className="w-6 h-6" />;
    }
  };

  //Colors for different stages
  const getStageColor = (stage: string) => {
    switch (stage) {
      case "uploading":
        return "text-blue-500";
      case "processing":
        return "text-yellow-500";
      case "complete":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };
  return (
    <div className="bg-white rounded-lg border p-6 max-w-md mx-auto">
      {/* Stage Icon and Message */}
      <div className="flex items-center justify-center mb-4">
        <div className={`${getStageColor(progress.stage)} animate-pulse`}>
          {getStageIcon(progress.stage)}
        </div>
        <span className="ml-3 text-lg font-medium text-gray-700">
          {progress.message}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{progress.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ease-out ${
              progress.stage === "complete" ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
      </div>

      {/* Stage Indicators */}
      <div className="flex justify-between items-center">
        {["uploading", "processing", "complete"].map((stage, index) => {
          const isActive = progress.stage === stage;
          const isCompleted =
            ["uploading", "processing", "complete"].indexOf(progress.stage) >
            index;

          return (
            <div key={stage} className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  isActive
                    ? "border-blue-500 bg-blue-500 animate-pulse"
                    : isCompleted
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300 bg-white"
                }`}
              />
              <span
                className={`text-xs mt-1 capitalize ${
                  isActive || isCompleted ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>

      {/* Spinning Animation for Active Stages */}
      {progress.stage !== "complete" && (
        <div className="flex justify-center mt-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

export default UploadProgress;
