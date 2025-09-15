import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react";
import supabase from "../../../../utils/supabase";

interface Citation {
  page: number;
  content: string;
  similarity: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  documentId: string | null;
  isLoading: boolean;
  currentPage: number;
}

type ChatAction =
  | { type: "SET_DOCUMENT"; payload: string }
  | { type: "SET_SESSION"; payload: string }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_PAGE"; payload: number }
  | { type: "CLEAR_CHAT" };

const initialState: ChatState = {
  messages: [],
  sessionId: null,
  documentId: null,
  isLoading: false,
  currentPage: 1,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_DOCUMENT":
      return { ...state, documentId: action.payload };
    case "SET_SESSION":
      return { ...state, sessionId: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_PAGE":
      return { ...state, currentPage: action.payload };
    case "CLEAR_CHAT":
      return { ...initialState, documentId: state.documentId };
    default:
      return state;
  }
}

const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  sendMessage: (message: string) => Promise<void>;
  goToPage: (page: number) => void;
} | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const sendMessage = async (message: string) => {
    if (!state.documentId) return;

    dispatch({ type: "SET_LOADING", payload: true });

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMessage });

    try {
      const { data, error } = await supabase.functions.invoke("Pdf_chat", {
        body: {
          message,
          document_id: state.documentId,
          session_id: state.sessionId,
        },
      });

      if (error) throw error;

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: data.message_id || crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        citations: data.citations,
        timestamp: new Date(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });

      if (!state.sessionId && data.session_id) {
        dispatch({ type: "SET_SESSION", payload: data.session_id });
      }
    } catch (error) {
      console.error("Chat error:", error);

      // Add error message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      dispatch({ type: "ADD_MESSAGE", payload: errorMessage });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const goToPage = (page: number) => {
    dispatch({ type: "SET_PAGE", payload: page });
  };

  return (
    <ChatContext.Provider value={{ state, dispatch, sendMessage, goToPage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
