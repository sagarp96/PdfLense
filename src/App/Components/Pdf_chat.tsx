import React, { useState, useRef, useEffect } from "react";
import { IoSend } from "react-icons/io5";
import { useChat } from "./Context/Chat_context";
import ChatMessage from "./Chat_message";
import PdfViewer from "./Pdf_viewer";
import { ImCancelCircle } from "react-icons/im";
import { GiBrain } from "react-icons/gi";
interface PdfChatProps {
  documentUrl: string;
  documentId: string;
}

export default function PdfChat({ documentUrl, documentId }: PdfChatProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const { state, dispatch, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dispatch({ type: "SET_DOCUMENT", payload: documentId });
  }, [documentId, dispatch]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || state.isLoading) return;

    const message = inputMessage.trim();
    setInputMessage("");
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ChatWindow grid grid-cols-2 h-[90vh] w-[95%] mx-auto my-4 rounded-lg shadow-2xl border overflow-hidden">
      <div className="col-start-1 flex flex-col min-h-0 border-r">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between  flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800 flex gap-3">
            <GiBrain className="inline mt-1 text-blue-500" size={24} />
            PdfLense
          </h2>

          <button
            aria-label="Close session"
            onClick={() => setShowConfirmClose(true)}
            className="grid place-items-center hover:cursor-pointer hover:opacity-70"
            title="Close"
          >
            <ImCancelCircle size={25} color="red" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {state.messages.length === 0 ? (
            <div className="text-center text-black mt-8">
              <p>Start a conversation about your document</p>
              <p className="text-sm mt-2">
                Ask questions about the content, and I'll provide answers with
                citations!
              </p>
            </div>
          ) : (
            state.messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                citations={message.citations}
                timestamp={message.timestamp}
              />
            ))
          )}

          {state.isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t flex-shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the document..."
              className="flex-1 border border-gray-300 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              rows={2}
              disabled={state.isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || state.isLoading}
              className="p-3 mb-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IoSend size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Right: PDF Viewer column */}
      <div className="col-start-2 min-h-0">
        <PdfViewer documentUrl={documentUrl} className="h-full" />
      </div>

      {showConfirmClose && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] grid place-items-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-sm p-5">
            <h3 className="text-lg font-semibold mb-2">End session?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to close this session?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmClose(false)}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                No
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
