import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useChat } from "./Context/Chat_context";
import { FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";
import { CiZoomIn, CiZoomOut } from "react-icons/ci";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
interface PdfViewerProps {
  documentUrl: string;
  className?: string;
}

export default function PdfViewer({ documentUrl, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const { state, goToPage } = useChat();
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= numPages) {
      goToPage(newPage);
    }
  };

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* PDF Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(state.currentPage - 1)}
            disabled={state.currentPage <= 1}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 cursor-pointer"
          >
            <FaAngleDoubleLeft size={25} />
          </button>

          <span className="text-sm text-black">
            Page {state.currentPage} of {numPages}
          </span>

          <button
            onClick={() => handlePageChange(state.currentPage + 1)}
            disabled={state.currentPage >= numPages}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 cursor-pointer"
          >
            <FaAngleDoubleRight size={25} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(scale * 0.8)}
            className="px-2 py-1 bg-gray-500 text-white rounded text-sm cursor-pointer"
          >
            <CiZoomOut size={25} />
          </button>
          <span className="text-sm text-black">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(scale * 1.2)}
            className="px-2 py-1 bg-gray-500 text-white rounded text-sm cursor-pointer"
          >
            <CiZoomIn size={25} />
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div className="w-full h-full flex justify-center">
          <Document
            file={documentUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="shadow-lg"
            loading={<div className="p-4  text-black ">Loading PDF...</div>}
            error={<div className="p-4 text-red-500 ">Error loading PDF</div>}
          >
            <Page
              pageNumber={state.currentPage}
              scale={scale}
              className="border bg-white mx-auto"
              loading={<div className="p-2">Loading page...</div>}
              error={<div className="p-2 text-red-500">Error loading page</div>}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
