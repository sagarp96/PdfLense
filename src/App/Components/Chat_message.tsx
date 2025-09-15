import { useChat } from "./Context/Chat_context";

interface Citation {
  page: number;
  content: string;
  similarity: number;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

function Citation({ page, content }: { page: number; content: string }) {
  const { goToPage } = useChat();

  const handleClick = () => {
    goToPage(page);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center px-2 py-1 mx-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors duration-200"
      title={`Go to page ${page}\n${content}`}
    >
      Page {page}
    </button>
  );
}

export default function ChatMessage({
  role,
  content,
  citations,
  timestamp,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-3xl px-4 py-2 rounded-lg ${
          isUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
        }`}
      >
        <div className="text-sm mb-1 whitespace-pre-wrap">{content}</div>

        {citations && citations.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-1">Sources:</div>
            <div className="flex flex-wrap gap-1">
              {citations.map((citation, index) => (
                <Citation
                  key={index}
                  page={citation.page}
                  content={citation.content}
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-xs opacity-70 mt-1">
          {timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
