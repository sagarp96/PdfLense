import { FiUpload } from "react-icons/fi";
import { useDropzone } from "react-dropzone";
import { useState, useCallback } from "react";
import ProcessingIndicator from "./UI/Pdf_process_Status";
import supabase from "../../../utils/supabase";

interface UploadProgress {
  stage: "uploading" | "processing" | "complete";
  progress: number;
  message: string;
}

// Add this type definition
export interface ProcessedDocument {
  id: string;
  title: string;
  pageCount: number;
  bucket: string;
  path: string;
}

export default function FileUpload({
  onDocumentProcessed,
}: {
  onDocumentProcessed: (processedDocument: ProcessedDocument) => void;
}) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const bucket = "pdfs"; // Match your Edge Function expectation
    const id = crypto.randomUUID();
    const file = acceptedFiles[0];
    const ext = file.name.toLowerCase().endsWith(".pdf") ? "" : ".pdf";

    function filecleanup(name: string) {
      return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    }

    const path = `uploads/${id}-${filecleanup(file.name)}${ext}`;

    if (!file || file.type !== "application/pdf") {
      setError("Please upload a valid PDF file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File must be less than 50MB");
      return;
    }

    try {
      setError(null);

      setUploadProgress({
        stage: "uploading",
        progress: 30,
        message: "Uploading file...",
      });

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;
      setUploadProgress({
        stage: "processing",
        progress: 70,
        message: "Proceessing file...",
      });

      const { data, error } = await supabase.functions.invoke("Process_pdf", {
        body: {
          bucket,
          path,
          title: file.name,
        },
      });

      if (error) {
        throw new Error(error.message ?? "Processing failed");
      }

      const result: ProcessedDocument = {
        id: data.document_id,
        title: file.name,
        pageCount: data.page_count,
        bucket,
        path,
      };

      setUploadProgress({
        stage: "complete",
        progress: 100,
        message: `Successfully processed`,
      });
      onDocumentProcessed(result);
      console.log("Processed Document:", result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Processing failed");
      setUploadProgress(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
    },
  });

  return (
    <div className="min-h-screen w-full lg-80 grid place-items-center p-4">
      <div className="flex flex-col items-center gap-4  max-w-2xl">
        {!uploadProgress ? (
          <div
            {...getRootProps()}
            className={`w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400"
              }`}
          >
            <input {...getInputProps()} />
            <FiUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {isDragActive
                ? "Drop your PDF here"
                : "Upload PDF to start chatting"}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop or click to select (Max 50MB)
            </p>
          </div>
        ) : (
          <ProcessingIndicator progress={uploadProgress} />
        )}

        {error && (
          <div className="w-full p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
