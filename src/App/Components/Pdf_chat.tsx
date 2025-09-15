import React, { useState, useRef, useEffect } from "react";
import { IoSend } from "react-icons/io5";
import { useChat } from "./Context/Chat_context";
import ChatMessage from "./Chat_message";
import PdfViewer from "./Pdf_viewer";

interface PdfChatProps {
  documentUrl: string;
  documentId: string;
}

export default function PdfChat({ documentUrl, documentId }: PdfChatProps) {
  const [inputMessage, setInputMessage] = useState("");
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
    <div className="ChatWindow grid grid-cols-2 border h-full w-[90%] m-auto mt-4 rounded-lg shadow-2xl">
      <div className="col-start-1 flex flex-col border-r">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Chat with Document
          </h2>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {state.messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
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

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex items-end gap-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the document..."
              className="flex-1 border border-gray-300 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={state.isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || state.isLoading}
              className="p-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <IoSend size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="col-start-2">
        <PdfViewer documentUrl={documentUrl} className="h-full" />
      </div>
    </div>
  );
}
