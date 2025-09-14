import "../index.css";
import FileUpload from "./Components/File_upload";
import PdfChat from "./Components/Pdf_chat";
import { useState } from "react";
function App() {
  const [fileProcessed, setFileProcessed] = useState<boolean>(true);
  return (
    <>
      {fileProcessed ? (
        <PdfChat />
      ) : (
        <FileUpload fileProcessed={fileProcessed} />
      )}
    </>
  );
}

export default App;
