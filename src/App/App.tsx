import "../index.css";
import FileUpload from "./Components/File_upload";
import PdfChat from "./Components/Pdf_chat";
import { ChatProvider } from "./Components/Context/Chat_context";
import { useState } from "react";
import supabase from "../../utils/supabase";

interface ProcessedDocument {
  id: string;
  title: string;
  pageCount: number;
  bucket: string;
  path: string;
}

function App() {
  const [processedDocument, setProcessedDocument] =
    useState<ProcessedDocument | null>(null);

  const getDocumentUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  };

  return (
    <ChatProvider>
      {processedDocument ? (
        <PdfChat
          documentUrl={getDocumentUrl(
            processedDocument.bucket,
            processedDocument.path
          )}
          documentId={processedDocument.id}
        />
      ) : (
        <FileUpload onDocumentProcessed={setProcessedDocument} />
      )}
    </ChatProvider>
  );
}

export default App;
