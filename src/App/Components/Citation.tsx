import { useChat } from "./Context/Chat_context";

interface CitationProps {
  page: number;
  content: string;
  similarity: number;
}

export default function Citation({ page, content }: CitationProps) {
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
